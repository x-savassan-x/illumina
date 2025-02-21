import {
    window,
    workspace,
    Progress,
    ProgressLocation,
    CancellationToken,
    Uri,
    RelativePattern
} from "vscode";
import { relative } from "path";
import { CacheManager } from "@ext/bridge";
import { ConfigSection, getConfigValue } from "@ext/config";
import { CacheNode, FolderNode } from "@core/index";


export class StaticVizEngine {
    public isActive: boolean = false;
    private static _instance: StaticVizEngine;
    private readonly _cacheManager: CacheManager = CacheManager.getInstance();

    public static getInstance(): StaticVizEngine {
        this._instance ??= new StaticVizEngine();
        return this._instance;
    }

    public async activate(): Promise<void> {
        if (!CacheManager.isActive()) throw new Error('Cache system is not initialized');
        if (this.isActive) return;

        await this._cacheManager.waitProcessingNodes();

        await window.withProgress({
            location: ProgressLocation.Notification,
            title: "Initializing visualization...",
            cancellable: true
        }, async (progress, token) => this._initViz(progress, token));

        this.isActive = true;
    }

    public async deactivate(): Promise<void> {
        if (!this.isActive) return;
        await this._cacheManager.waitProcessingNodes();
        this.isActive = false;
    }

    public update(changedNode?: CacheNode, affectedParentNode?: FolderNode): void {
        if (!this.isActive) return;
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
            const tasks = batch.map(file => this._cacheManager.ensureNode(file));
            await Promise.all(tasks);
            processed += batch.length;

            progress.report({
                message: `Processing files (${processed}/${total})`,
                increment: (batch.length / total) * 100
            });
        }
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
