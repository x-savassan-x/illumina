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
import { Operation, Change } from "./Change";
import { ConfigSection, handleConfigChanges, getConfigValue } from "../../config";


export class Watcher {
    private readonly _workspaceFolder: WorkspaceFolder = workspace.workspaceFolders![0];
    private readonly _disposables: Disposable[];
    private _srcDir: string;
    private _srcLang: string;

    public constructor(
        private readonly _listener: (change: Change) => void
    ) {
        this._srcDir = getConfigValue<string>(ConfigSection.SourceDirectory);
        this._srcLang = getConfigValue<string>(ConfigSection.SourceLanguage);

        this._disposables = [
            workspace.onDidDeleteFiles(e => this._handleDeletion(e)),
            workspace.onDidChangeTextDocument(e => this._handleModification(e)),
            workspace.onDidRenameFiles(e => this._handleRenaming(e)),
            workspace.onDidChangeConfiguration(e => handleConfigChanges(e, [
                [ConfigSection.SourceDirectory, (): void => {
                    this._srcDir = getConfigValue<string>(ConfigSection.SourceDirectory);
                }],
                [ConfigSection.SourceLanguage, (): void => {
                    this._srcLang = getConfigValue<string>(ConfigSection.SourceLanguage);
                }]
            ]))
        ];
    }

    public dispose(): void {
        this._disposables.forEach(d => d.dispose());
    }

    private _handleDeletion(event: FileDeleteEvent): void {
        for (const uri of event.files) {
            if (!this._isInSourceScope(uri)) {
                continue;
            }

            this._listener({
                operation: Operation.Delete,
                path: this._getRelativePath(uri)
            });
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

        this._listener({
            operation: Operation.Modify,
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
        });
    }

    private _handleRenaming(event: FileRenameEvent): void {
        for (const { oldUri, newUri } of event.files) {
            if (!this._isInSourceScope(oldUri)) {
                continue;
            }

            if (!this._isInSourceScope(newUri)) { // Moved out of source directory
                this._listener({
                    operation: Operation.Delete,
                    path: this._getRelativePath(oldUri)
                });
                continue;
            }

            const oldName = basename(oldUri.fsPath);
            const newName = basename(newUri.fsPath);

            if (oldName !== newName) {
                this._listener({
                    operation: Operation.Rename,
                    path: this._getRelativePath(oldUri),
                    newName
                });
            }
            else {
                this._listener({
                    operation: Operation.Move,
                    path: this._getRelativePath(oldUri),
                    newDir: dirname(this._getRelativePath(newUri))
                });
            }
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
