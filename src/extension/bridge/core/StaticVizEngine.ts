import {
    window,
    workspace,
    Progress,
    ProgressLocation,
    CancellationToken,
    Uri,
    RelativePattern,
    EventEmitter,
    Event
} from "vscode";
import { relative } from "path";
import { CacheManager } from "@ext/bridge";
import { ConfigSection, getConfigValue } from "@ext/config";
import { MetricsProcessor, CacheNode, FolderNode } from "@core/index";
import { Logger } from "@ext/Logger";


export class StaticVizEngine {
    public readonly onUpdate: Event<void>;
    public isActive: boolean = false;
    private static _instance: StaticVizEngine;
    private readonly _metricsProcessor: MetricsProcessor = new MetricsProcessor();
    private readonly _updateEmitter = new EventEmitter<void>();

    private constructor() {
        this.onUpdate = this._updateEmitter.event;
    }

    public static getInstance(): StaticVizEngine {
        this._instance ??= new StaticVizEngine();
        return this._instance;
    }

    public async activate(): Promise<void> {
        if (!CacheManager.isActive()) throw new Error('Cache system is not initialized');
        if (this.isActive) return;

        await CacheManager.getInstance().waitProcessingNodes();

        await window.withProgress({
            title: "Initializing visualization",
            location: ProgressLocation.Notification,
            cancellable: true
        }, async (progress, token) => await this._initViz(progress, token));

        this.isActive = true;
    }

    public async deactivate(): Promise<void> {
        if (!this.isActive) return;
        await CacheManager.getInstance().waitProcessingNodes();
        this.isActive = false;
    }

    public update(changedNode?: CacheNode, affectedParentNode?: FolderNode): void {
        if (!this.isActive) return;
        if (!changedNode) this._updateEmitter.fire();
        else
            this._metricsProcessor.recalculate(changedNode, affectedParentNode)
            .then(() => this._updateEmitter.fire())
            .catch(error => Logger.error(error, 'StaticVizEngine'));
    }

    private async _initViz(
        progress: Progress<{ message?: string; increment?: number }>,
        token: CancellationToken
    ): Promise<void> {
        const sourceFiles = await this._getSourceFiles();
        if (token.isCancellationRequested)
            throw new Error('Visualization initialization was cancelled');

        const cacheManager = CacheManager.getInstance();
        const total = sourceFiles.length;
        const batchSize = 10;
        let processed = 0;

        for (let i = 0; i < total; i += batchSize) {
            if (token.isCancellationRequested)
                throw new Error('Visualization initialization was cancelled');

            const batch = sourceFiles.slice(i, i + batchSize);
            const tasks = batch.map(file => cacheManager.ensureNode(file));
            await Promise.all(tasks);
            processed += batch.length;

            progress.report({
                message: `Processing files (${processed}/${total})`,
                increment: (batch.length / total) * 100
            });
        }

        await cacheManager.waitProcessingNodes();
        await this._metricsProcessor.calculate(cacheManager.root);
    }

    private async _getSourceFiles(): Promise<[string, Uri][]> {
        const folder = workspace.workspaceFolders![0];
        const sourceDir = getConfigValue<string>(ConfigSection.SourceDirectory);
        const srcLang = getConfigValue<string>(ConfigSection.SourceLanguage);
        const srcRoot = `${folder.uri.path}/${sourceDir}`;

        const pattern = new RelativePattern(folder, `${sourceDir}/**/*${srcLang}`);
        const uris = await workspace.findFiles(pattern);
        return uris.map(uri => ([relative(srcRoot, uri.path), uri]));
    }
}
