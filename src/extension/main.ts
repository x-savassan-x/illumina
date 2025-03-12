import { workspace, ExtensionContext, Disposable } from 'vscode';
import { Watcher, CacheManager } from './bridge';
import { visualize } from './commands';
import { Logger } from './Logger';


export function activate(context: ExtensionContext): void {
    Logger.init();

    let system = initSystem();

    context.subscriptions.push(
        workspace.onDidChangeWorkspaceFolders(_ => {
            Logger.info('Workspace changed');
            system?.dispose();
            system = initSystem();
        }),
        { dispose: () => system?.dispose() },
        visualize(context.extensionUri),
        Logger
    );

    Logger.info('Extension activated');
}


function initSystem(): Disposable | undefined {
    const folders = workspace.workspaceFolders;

    if (!folders || folders.length > 1) return;

    try {
        const cacheManager = CacheManager.instance;
        Logger.info('CacheManager initialized');

        const watcher = Watcher.getInstance(
            folders[0].uri.path,
            change => cacheManager.handleChange(change)
        );
        Logger.info('Watcher initialized');

        return Disposable.from(watcher, cacheManager);
    }
    catch (error) {
        Logger.error(`${error}`, 'initSystem');
        return;
    }
}
