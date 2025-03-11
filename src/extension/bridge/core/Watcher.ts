import {
    workspace,
    Disposable,
    Uri,
    FileDeleteEvent,
    TextDocumentChangeEvent,
    FileRenameEvent
} from "vscode";
import { extname, relative, basename, dirname } from "path";
import { Operation, Change } from "./Change";
import { ConfigSection, handleConfigChanges, getConfigValue } from "@ext/config";


export class Watcher {
    private static _instance: Watcher | undefined;
    private readonly _disposable: Disposable;
    private _srcRoot: string;
    private _srcLang: string;

    private constructor(
        private readonly _workspaceRoot: string,
        private readonly _listener: (change: Change) => void
    ) {
        this._srcRoot = `${this._workspaceRoot}/${getConfigValue<string>(ConfigSection.SourceDirectory)}`;
        this._srcLang = getConfigValue<string>(ConfigSection.SourceLanguage);

        this._disposable = Disposable.from(
            workspace.onDidDeleteFiles(e => this._handleDeletion(e)),
            workspace.onDidChangeTextDocument(e => this._handleModification(e)),
            workspace.onDidRenameFiles(e => this._handleRenaming(e)),
            workspace.onDidChangeConfiguration(e => handleConfigChanges(e, [
                [[ConfigSection.SourceDirectory], (): void => {
                    this._srcRoot = `${this._workspaceRoot}/${getConfigValue<string>(ConfigSection.SourceDirectory)}`;
                }],
                [[ConfigSection.SourceLanguage], (): void => {
                    this._srcLang = getConfigValue<string>(ConfigSection.SourceLanguage);
                }]
            ]))
        );
    }

    public static getInstance(
        workspaceRoot: string,
        listener: (change: Change) => void
    ): Watcher {
        Watcher._instance ??= new Watcher(workspaceRoot, listener);
        return Watcher._instance;
    }

    public dispose(): void {
        this._disposable.dispose();
        Watcher._instance = undefined;
    }

    private _handleDeletion(event: FileDeleteEvent): void {
        for (const uri of event.files) {
            const [inScope, path] = this._checkScope(uri);
            if (!inScope) return;

            this._listener({
                operation: Operation.Delete,
                path
            });
        }
    }

    private _handleModification(event: TextDocumentChangeEvent): void {
        if (!event.contentChanges.length) return;

        const doc = event.document;
        const [inScope, path] = this._checkScope(doc.uri);

        if (!inScope) return;

        this._listener({
            operation: Operation.Modify,
            path,
            content: doc.getText(),
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
                    }
                    else column += lines[0].length;
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
            const [inOldScope, oldPath] = this._checkScope(oldUri);
            if (!inOldScope) continue;

            const [inNewScope, newPath] = this._checkScope(newUri);
            if (!inNewScope) { // Moved out of source directory
                this._listener({
                    operation: Operation.Delete,
                    path: oldPath
                });
                continue;
            }

            const oldName = basename(oldPath);
            const newName = basename(newPath);

            if (oldName !== newName) { // src/foo -> src/bar
                this._listener({
                    operation: Operation.Rename,
                    path: oldPath,
                    newName
                });
            }
            else { // com/foo -> net/foo
                this._listener({
                    operation: Operation.Move,
                    path: oldPath,
                    newDir: dirname(newPath)
                });
            }
        }
    }

    private _checkScope(uri: Uri): [boolean, string] {
        if (uri.scheme !== 'file')
            return [false, ''];

        const relPath = this._getRelPath(uri);
        if (relPath.startsWith('..')) // outside source directory
            return [false, ''];

        const ext = extname(uri.path);
        if (ext && ext !== this._srcLang) // is file but not source file
            return [false, ''];

        return [true, relPath];
    }

    // path relative to source directory
    private _getRelPath(uri: Uri): string {
        return relative(this._srcRoot, uri.path);
    }
}
