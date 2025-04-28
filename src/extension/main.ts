import { workspace, ExtensionContext, Disposable } from 'vscode';
import { Watcher, CacheManager, StaticVizEngine, VizPanel } from './bridge';
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
        VizPanel,
        Logger
    );

    Logger.info('Extension activated');
}


function initSystem(): Disposable | undefined {
    const folders = workspace.workspaceFolders;

    if (!folders || folders.length > 1) return;

    try {
        const watcher = Watcher.instance;
        const cacheManager = CacheManager.instance;
        watcher.changesHandler = (changes): void => cacheManager.handleChanges(changes);
        const vizEngine = StaticVizEngine.instance;

        return Disposable.from(watcher, cacheManager, vizEngine);
    }
    catch (error) {
        Logger.error(`${error}`, 'initSystem');
        return;
    }
}
