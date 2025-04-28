import {
    window,
    workspace,
    Disposable,
    Progress,
    ProgressLocation,
    CancellationToken,
    Uri,
    RelativePattern,
    EventEmitter
} from "vscode";
import { basename, relative } from "path";
import { CacheManager } from "@ext/bridge";
import { ConfigSection, getConfigValue } from "@ext/config";
import { MetricsProcessor, CacheNode, FolderNode } from "@core/index";
import { Logger } from "@ext/Logger";


export class StaticVizEngine {
    public readonly updateEmitter = new EventEmitter<void>();
    public isActive: boolean = false;
    private static _instance: StaticVizEngine | undefined;
    private readonly _cacheManager = CacheManager.instance;
    private readonly _metricsProcessor = new MetricsProcessor();
    private _disposable = Disposable.from();

    public static get instance(): StaticVizEngine {
        this._instance ??= new StaticVizEngine();
        return this._instance;
    }

    public async activate(): Promise<void> {
        if (this.isActive) return;

        await this._cacheManager.waitProcessingNodes();

        this._disposable = this._cacheManager.updateEmitter.event(
            ([changedNode, affectedParentNode]) => this._update(changedNode, affectedParentNode)
        );

        await window.withProgress({
            title: "Initializing visualization",
            location: ProgressLocation.Notification,
            cancellable: true
        }, async (progress, token) => await this._initViz(progress, token));

        this.isActive = true;

        Logger.info('Visualization is activated');
    }

    public async deactivate(): Promise<void> {
        if (!this.isActive) return;
        await this._cacheManager.waitProcessingNodes();
        this._disposable.dispose();
        this.isActive = false;

        Logger.info('Visualization is deactivated');
    }

    public dispose(): void {
        this.updateEmitter.dispose();
        this._disposable.dispose();
        StaticVizEngine._instance = undefined;
    }

    private async _initViz(
        progress: Progress<{ message?: string; increment?: number }>,
        token: CancellationToken
    ): Promise<void> {
        const sourceFiles = await this._getSourceFiles();
        if (token.isCancellationRequested)
            throw new Error('Visualization initialization was cancelled');

        const total = sourceFiles.length;
        const batchSize = 10;
        let processed = 0;

        for (let i = 0; i < total; i += batchSize) {
            if (token.isCancellationRequested)
                throw new Error('Visualization initialization was cancelled');

            const batch = sourceFiles.slice(i, i + batchSize);
            await Promise.all(batch.map(file => this._cacheManager.ensureNode(file)));
            processed += batch.length;

            progress.report({
                message: `Processing files (${processed}/${total})`,
                increment: (batch.length / total) * 100
            });
        }

        await this._cacheManager.waitProcessingNodes();
        await this._metricsProcessor.calculate(this._cacheManager.cacheRoot);
    }

    private _update(changedNode?: CacheNode, affectedParentNode?: FolderNode): void {
        if (!this.isActive) return;
        if (!changedNode) this.updateEmitter.fire();
        else
            this._metricsProcessor.recalculate(changedNode, affectedParentNode)
            .then(() => this.updateEmitter.fire())
            .catch(error => Logger.error(error, 'StaticVizEngine'));
    }

    private async _getSourceFiles(): Promise<[string, Uri][]> {
        const folder = workspace.workspaceFolders![0];
        const sourceDir = getConfigValue<string>(ConfigSection.SourceDirectory);
        const srcLang = getConfigValue<string>(ConfigSection.SourceLanguage);
        const srcRoot = `${folder.uri.path}/${sourceDir}`;

        const pattern = new RelativePattern(folder, `${sourceDir}/**/*${srcLang}`);
        const uris = await workspace.findFiles(pattern);

        const ignoredFiles = new Set(getConfigValue<string[]>(ConfigSection.IgnoredFiles));

        return uris.filter(uri => !ignoredFiles.has(basename(uri.path)))
                    .map(uri => ([relative(srcRoot, uri.path), uri]));
    }
}
