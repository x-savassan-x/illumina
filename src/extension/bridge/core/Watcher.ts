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
import { Debouncer } from "./Debouncer";
import { ConfigSection, handleConfigChanges, getConfigValue } from "@ext/config";
import { Logger } from "@ext/Logger";


export class Watcher {
    public changesHandler: (changes: Change[]) => void = () => { };
    private static _instance: Watcher | undefined;
    private readonly _debouncer = new Debouncer();
    private readonly _disposable: Disposable;
    private _srcRoot = getConfigValue<string>(ConfigSection.SourceDirectory);
    private _srcLang = getConfigValue<string>(ConfigSection.SourceLanguage);
    private _ignoredFiles = new Set(getConfigValue<string[]>(ConfigSection.IgnoredFiles));
    private _pendingChanges: Change[] = [];
    private _currentChanges: Change[] = [];

    private constructor() {
        this._srcRoot = `${this._getWorkspaceRoot()}/${this._srcRoot}`;

        this._disposable = Disposable.from(
            workspace.onDidDeleteFiles(e => this._handleDeletion(e)),
            workspace.onDidChangeTextDocument(e => this._handleModification(e)),
            workspace.onDidRenameFiles(e => this._handleRenaming(e)),
            workspace.onDidChangeConfiguration(e => handleConfigChanges(e, [
                [[ConfigSection.SourceDirectory], (): void => {
                    const srcDir = getConfigValue<string>(ConfigSection.SourceDirectory);
                    this._srcRoot = `${this._getWorkspaceRoot()}/${srcDir}`;
                }],
                [[ConfigSection.SourceLanguage], (): void => {
                    this._srcLang = getConfigValue<string>(ConfigSection.SourceLanguage);
                }],
                [[ConfigSection.IgnoredFiles], (): void => {
                    this._ignoredFiles = new Set(getConfigValue<string[]>(ConfigSection.IgnoredFiles));
                }]
            ]))
        );

        Logger.info('Watcher initialized');
    }

    public static get instance(): Watcher {
        this._instance ??= new Watcher();
        return this._instance;
    }

    public dispose(): void {
        this._disposable.dispose();
        this._debouncer.dispose();
        Watcher._instance = undefined;
    }

    private _handleDeletion(event: FileDeleteEvent): void {
        for (const uri of event.files) {
            const [inScope, path] = this._checkScope(uri);
            if (!inScope) return;

            this._handleChange({
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

        this._handleChange({
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
                this._handleChange({
                    operation: Operation.Delete,
                    path: oldPath
                });
                continue;
            }

            const oldName = basename(oldPath);
            const newName = basename(newPath);

            if (oldName !== newName) { // src/foo -> src/bar
                this._handleChange({
                    operation: Operation.Rename,
                    path: oldPath,
                    newName
                });
            }
            else { // com/foo -> net/foo
                this._handleChange({
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

        // path relative to source directory
        const relPath = relative(this._srcRoot, uri.path);
        if (relPath.startsWith('..')) // outside source directory
            return [false, ''];

        const ext = extname(uri.path);
        if (ext) { // is file
            if (ext !== this._srcLang) // is file but not source file
                return [false, ''];

            const fileName = basename(uri.path);
            if (this._ignoredFiles.has(fileName)) // ignored file
                return [false, ''];
        }

        return [true, relPath];
    }

    private _handleChange(change: Change): void {
        if (!this._tryMergeChange(change))
            this._pendingChanges.push(change);
        this._debouncer.schedule(() => this._processChanges());
    }

        private _tryMergeChange(newChange: Change): boolean {
        const lastChange = this._pendingChanges.at(-1);

        if (!lastChange || // no pending change
            lastChange.path !== newChange.path || // not in same file
            lastChange.operation !== Operation.Modify || // not file modification
            newChange.operation !== Operation.Modify ||
            lastChange.edits.length > 1 || // change in multiple places, cant merge
            newChange.edits.length > 1) return false;

        const lastEdit = lastChange.edits[0];
        const newEdit = newChange.edits[0];

        // check if modification is adding or deleting
        const lastAdd = lastEdit.newEndIndex > lastEdit.oldEndIndex;
        const newAdd = newEdit.newEndIndex > newEdit.oldEndIndex;

        if (lastAdd !== newAdd) return false;

        if (newAdd) { // adding
            if (newEdit.startIndex !== lastEdit.newEndIndex) return false;

            this._pendingChanges[this._pendingChanges.length - 1] = {
                ...newChange,
                edits: [{
                    startIndex: lastEdit.startIndex,
                    oldEndIndex: lastEdit.oldEndIndex,
                    newEndIndex: newEdit.newEndIndex,
                    startPosition: lastEdit.startPosition,
                    oldEndPosition: lastEdit.oldEndPosition,
                    newEndPosition: newEdit.newEndPosition
                }]
            };
        }
        else { // deleting
            if (newEdit.oldEndIndex !== lastEdit.startIndex) return false;

            this._pendingChanges[this._pendingChanges.length - 1] = {
                ...newChange,
                edits: [{
                    startIndex: newEdit.startIndex,
                    oldEndIndex: lastEdit.oldEndIndex,
                    newEndIndex: newEdit.newEndIndex,
                    startPosition: newEdit.startPosition,
                    oldEndPosition: lastEdit.oldEndPosition,
                    newEndPosition: newEdit.newEndPosition
                }]
            };
        }

        return true;
    }

    private _processChanges(): void {
        if (this._currentChanges.length) return;

        this._currentChanges = this._pendingChanges;
        this._pendingChanges = [];
        this.changesHandler(this._currentChanges);
        this._currentChanges = [];

        if (this._pendingChanges.length)
            this._debouncer.schedule(() => this._processChanges());
    }

    private _getWorkspaceRoot(): string {
        const folder = workspace.workspaceFolders![0];
        return folder.uri.path;
    }
}
