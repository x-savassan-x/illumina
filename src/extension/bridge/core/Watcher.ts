import {
    workspace,
    Disposable,
    WorkspaceFolder,
    Uri,
    FileDeleteEvent,
    TextDocumentChangeEvent,
    FileRenameEvent
} from "vscode";
import { extname, relative, sep, basename, dirname } from "path";
import { Change } from "./Change";
import { getConfig } from "../../utils";
import { Logger } from "../../logger";


const logger = Logger.instance;


export class Watcher {
    private readonly _workspaceFolder: WorkspaceFolder = workspace.workspaceFolders![0];
    private readonly _disposables: Disposable[] = [];
    private _srcDir: string;
    private _srcLang: string;

    public constructor(
        private readonly _listener: (change: Change) => void
    ) {
        this._srcDir = getConfig<string>('sourceDirectory');
        this._srcLang = getConfig<string>('sourceLanguage');

        this._disposables.push(
            workspace.onDidDeleteFiles(e => this._handleDeletion(e)),
            workspace.onDidChangeTextDocument(e => this._handleModification(e)),
            workspace.onDidRenameFiles(e => this._handleRenaming(e)),
            workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('illumina.sourceDirectory', this._workspaceFolder)) {
                    this._srcDir = getConfig<string>('sourceDirectory');
                    logger.debug(`Source directory changed to ${this._srcDir || 'workspace root'}`, 'Watcher');
                }
                else if (e.affectsConfiguration('illumina.sourceLanguage', this._workspaceFolder)) {
                    this._srcLang = getConfig<string>('sourceLanguage');
                    logger.debug(`Source language changed to ${this._srcLang}`, 'Watcher');
                }
            })
        );
    }

    public dispose(): void {
        this._disposables.forEach(d => d.dispose());
    }

    private _handleDeletion(event: FileDeleteEvent): void {
        for (const uri of event.files) {
            if (!this._isInSourceScope(uri)) {
                continue;
            }

            const change: Change = {
                operation: 'delete',
                path: this._getRelativePath(uri)
            };

            logger.debug(`Deleted file/folder: ${change.path}`, 'Watcher');

            this._listener(change);
        }
    }

    private _handleModification(event: TextDocumentChangeEvent): void {
        if (!event.contentChanges.length) {
            return;
        }

        const document = event.document;
        const uri = document.uri;

        if (!this._isInSourceScope(uri)) {
            return;
        }

        const change: Change = {
            operation: 'modify',
            path: this._getRelativePath(uri),
            content: document.getText(),
            edits: event.contentChanges.map(change => {
                const startIndex = change.rangeOffset;
                const oldEndIndex = startIndex + change.rangeLength;
                const newEndIndex = startIndex + change.text.length;
                const startPosition = {
                    row: change.range.start.line,
                    column: change.range.start.character
                };
                const oldEndPosition = {
                    row: change.range.end.line,
                    column: change.range.end.character
                };

                let { row, column } = startPosition;
                if (change.text) {
                    const lines = change.text.split('\n');
                    if (lines.length > 1) {
                        row += lines.length - 1;
                        column = lines.at(-1)!.length;
                    } else {
                        column += lines[0].length;
                    }
                }
                const newEndPosition = { row, column };

                return {
                    startIndex, oldEndIndex, newEndIndex,
                    startPosition, oldEndPosition, newEndPosition
                };
            })
        };

        logger.debug(`Modified file: ${change.path}`, 'Watcher', { edits: change.edits });

        this._listener(change);
    }

    private _handleRenaming(event: FileRenameEvent): void {
        for (const { oldUri, newUri } of event.files) {
            if (!this._isInSourceScope(oldUri)) {
                continue;
            }

            if (!this._isInSourceScope(newUri)) {
                this._listener({
                    operation: 'delete',
                    path: this._getRelativePath(oldUri)
                });
                continue;
            }

            let change: Change;

            const oldName = basename(oldUri.fsPath);
            const newName = basename(newUri.fsPath);

            if (oldName !== newName) {
                change = {
                    operation: 'rename',
                    parentPath: dirname(this._getRelativePath(oldUri)),
                    oldName,
                    newName
                };
                logger.debug(`Renamed file: ${change.oldName} -> ${change.newName}`, 'Watcher', { parentPath: change.parentPath });
            }
            else {
                change = {
                    operation: 'move',
                    from: this._getRelativePath(oldUri),
                    to: this._getRelativePath(newUri)
                };
                logger.debug(`Moved file: ${change.from} -> ${change.to}`, 'Watcher');
            }

            this._listener(change);
        }
    }

    private _isInSourceScope(uri: Uri): boolean {
        if (uri.scheme !== 'file') {
            return false;
        }

        const relPath = this._getRelativePath(uri);
        if (relPath.startsWith('..') // outside workspace
            || (this._srcDir && relPath.split(sep)[0] !== this._srcDir) // outside source directory
        ) {
            return false;
        }

        const ext = extname(uri.fsPath);
        if (ext && ext !== this._srcLang) { // is file but not source file
            return false;
        }

        return true;
    }

    private _getRelativePath(uri: Uri): string {
        return relative(this._workspaceFolder.uri.fsPath, uri.fsPath);
    }
}
