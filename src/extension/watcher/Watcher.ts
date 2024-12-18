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
import { getConfig } from "../util";


export class Watcher {
    private readonly _disposables: Disposable[] = [];
    private _srcDir: string;
    private _srcLang: string;

    public constructor(
        private readonly _workspaceFolder: WorkspaceFolder,
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
                }

                if (e.affectsConfiguration('illumina.sourceLanguage', this._workspaceFolder)) {
                    this._srcLang = getConfig<string>('sourceLanguage');
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

            this._listener({
                operation: 'delete',
                path: this._getRelativePath(uri),
                isFile: extname(uri.fsPath).length > 0
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
        });
    }

    private _handleRenaming(event: FileRenameEvent): void {
        for (const { oldUri, newUri } of event.files) {
            if (!this._isInSourceScope(oldUri)
                || !this._isInSourceScope(newUri)) {
                continue;
            }
            const oldName = basename(oldUri.fsPath);
            const newName = basename(newUri.fsPath);
            if (oldName !== newName) { // renaming
                this._listener({
                    operation: 'rename',
                    parentPath: dirname(this._getRelativePath(oldUri)),
                    oldName,
                    newName
                });
            } else { // moving
                this._listener({
                    operation: 'move',
                    from: this._getRelativePath(oldUri),
                    to: this._getRelativePath(newUri)
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
        if (ext && ext !== this._srcLang) {
            return false;
        }

        return true;
    }

    private _getRelativePath(uri: Uri): string {
        return relative(this._workspaceFolder.uri.fsPath, uri.fsPath);
    }
}
