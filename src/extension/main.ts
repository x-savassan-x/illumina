import { workspace, ExtensionContext, WorkspaceFolder } from 'vscode';
import { Logger } from './Logger';
import { Watcher, TreeManager } from './bridge';


export function activate(context: ExtensionContext): void {
    Logger.init();

    let treeManager = getTreeManager(workspace.workspaceFolders!);
    let watcher = getWatcher(treeManager);

    context.subscriptions.push(
        workspace.onDidChangeWorkspaceFolders(_ => {
            watcher?.dispose();
            treeManager?.dispose();
            treeManager = getTreeManager(workspace.workspaceFolders!);
            watcher = getWatcher(treeManager);
        }),
        { dispose: () => {
            watcher?.dispose();
            treeManager?.dispose();
        }},
        Logger
    );

    Logger.info('Extension activated', 'Extension');
}


function getWatcher(treeManager?: TreeManager): Watcher | undefined {
    if (!treeManager) {
        return;
    }

    Logger.info('Watcher initialized', 'Extension');

    return new Watcher(change => treeManager.handleChange(change));
}


function getTreeManager(folders: readonly WorkspaceFolder[]): TreeManager | undefined {
    if (folders.length > 1) {
        Logger.warn('Multi-root workspaces are not supported', 'Extension');
        return;
    }

    Logger.info('Tree manager initialized', 'Extension');

    return new TreeManager();
}