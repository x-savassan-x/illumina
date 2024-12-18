import { workspace, ExtensionContext, WorkspaceFolder } from 'vscode';
import { Logger } from './logger';
import { Watcher } from './watcher';


export function activate(context: ExtensionContext): void {
    const logger = Logger.instance;
    logger.info('Activating extension...', 'Extension');

    let watcher = getWatcher(workspace.workspaceFolders!);

    context.subscriptions.push(
        { dispose: () => watcher?.dispose() },
        workspace.onDidChangeWorkspaceFolders(_ => {
            watcher?.dispose();
            watcher = getWatcher(workspace.workspaceFolders!);
            if (watcher) {
                logger.info('Reinitialized watcher for new workspace.', 'Extension');
            }
        }),
        logger
    );

    logger.info('Extension activated', 'Extension');
}


function getWatcher(
    folders: readonly WorkspaceFolder[]
): Watcher | undefined {

    const logger = Logger.instance;

    if (folders.length > 1) {
        logger.warn('Multi-root workspaces are not supported', 'Extension');
        return;
    }

    return new Watcher(folders[0], change => {
        switch (change.operation) {
            case 'delete':
                logger.debug(
                    `Deleted ${change.isFile ? 'file' : 'folder'}: ${change.path}`,
                    'Watcher'
                );
                break;
            case 'modify':
                logger.debug(
                    `Modified file: ${change.path}`,
                    'Watcher',
                    { edits: change.edits }
                );
                break;
            case 'rename':
                logger.debug(
                    `Renamed file: ${change.oldName} -> ${change.newName}`,
                    'Watcher',
                    { parentPath: change.parentPath }
                );
                break;
            case 'move':
                logger.debug(
                    `Moved file: ${change.from} -> ${change.to}`,
                    'Watcher'
                );
                break;
        }
    });
}
