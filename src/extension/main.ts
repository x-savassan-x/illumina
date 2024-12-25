import { workspace, ExtensionContext, WorkspaceFolder } from 'vscode';
import { Logger } from './logger';
import { Watcher, TreeManager } from './bridge';


export function activate(context: ExtensionContext): void {
    const logger = Logger.instance;

    const treeManager = new TreeManager();
    let watcher = getWatcher(workspace.workspaceFolders!, treeManager);

    context.subscriptions.push(
        { dispose: () => watcher?.dispose()},
        workspace.onDidChangeWorkspaceFolders(_ => {
            watcher?.dispose();
            treeManager.dispose();
            watcher = getWatcher(workspace.workspaceFolders!, treeManager);
            if (watcher) {
                logger.info('Reinitialized watcher for new workspace', 'Extension');
            }
        }),
        treeManager,
        logger
    );

    logger.info('Extension activated', 'Extension');
}


function getWatcher(
    folders: readonly WorkspaceFolder[],
    treeManager: TreeManager
): Watcher | undefined {

    if (folders.length > 1) {
        Logger.instance.warn('Multi-root workspaces are not supported', 'Extension');
        return;
    }

    return new Watcher(change => treeManager.handleChange(change));
}
