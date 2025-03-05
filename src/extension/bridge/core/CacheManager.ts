import { workspace, Disposable, Uri } from "vscode";
import { sep } from "path";
import { LRUCache } from "lru-cache";
import { Tree, Edit } from "tree-sitter";
import { Operation, Change } from "./Change";
import { Debouncer } from "./Debouncer";
import { StaticVizEngine } from "./StaticVizEngine";
import { CacheNode, FolderNode, FileNode, Analyzer, getAnalyzer } from "@core/index";
import { ConfigSection, getConfigValue, handleConfigChanges } from "@ext/config";
import { Logger } from "@ext/Logger";


export class CacheManager {
    public root: FolderNode;
    public static readonly isActive = (): boolean => !!this._instance;
    private static _instance: CacheManager | undefined;
    private readonly _debouncer = new Debouncer();
    private readonly _processingNodes = new Map<FileNode, Promise<void>>();
    private readonly _vizEngine = StaticVizEngine.getInstance();
    private readonly _disposable: Disposable;
    private _cache: LRUCache<FileNode, Tree>;
    private _pendingChanges: Change[] = [];
    private _currentChanges: Change[] = [];
    private _analyzer: Analyzer;

    private constructor() {
        this.root = new FolderNode(getConfigValue<string>(ConfigSection.SourceDirectory));
        this._cache = this._getNewCache();
        this._analyzer = getAnalyzer(getConfigValue<string>(ConfigSection.SourceLanguage));
        this._disposable = workspace.onDidChangeConfiguration(e => handleConfigChanges(e, [
            [[ConfigSection.SourceDirectory, ConfigSection.SourceLanguage], (): void => {
                this.root = new FolderNode(getConfigValue<string>(ConfigSection.SourceDirectory));
                this._cache.clear();
            }],
            [[ConfigSection.SourceLanguage], (): void => {
                this._analyzer = getAnalyzer(getConfigValue<string>(ConfigSection.SourceLanguage));
            }],
            [[ConfigSection.MaxCacheSize], (): void => {
                const cache = this._getNewCache();
                this._cache.forEach((tree, node) => cache.set(node, tree));
                this._cache = cache;
            }]
        ]));
    }

    public static getInstance(): CacheManager {
        this._instance ??= new CacheManager();
        return this._instance;
    }

    public handleChange(change: Change): void {
        if (!this._tryMergeModification(change))
            this._pendingChanges.push(change);
        this._debouncer.schedule(() => this._processChanges());
    }

    public dispose(): void {
        this._disposable.dispose();
        this._debouncer.dispose();
        CacheManager._instance = undefined;
    }

    public async ensureNode(data: [string, Uri]): Promise<void> {
        const [path, uri] = data;
        const node = this._findNode(path) as FileNode ?? this._createFileNode(path);
        if (node.updated) return;

        node.updated = true;
        const bytes = await workspace.fs.readFile(uri);
        const content = new TextDecoder().decode(bytes);
        const tree = this._analyzer.getTree(content);

        if (this._cache.size < this._cache.max) this._cache.set(node, tree);
        this._processNode(node, tree);
    }

    public async waitProcessingNodes(): Promise<void> {
        await Promise.all(this._processingNodes.values());
    }

    private _tryMergeModification(newChange: Change): boolean {
        if (!this._pendingChanges.length) return false;

        const lastChange = this._pendingChanges.at(-1)!;

        if (lastChange.path !== newChange.path ||
            lastChange.operation !== Operation.Modify ||
            newChange.operation !== Operation.Modify ||
            lastChange.edits.length > 1 ||
            newChange.edits.length > 1) return false;

        const lastEdit = lastChange.edits[0];
        const newEdit = newChange.edits[0];

        const lastAdd = lastEdit.newEndIndex > lastEdit.oldEndIndex;
        const newAdd = newEdit.newEndIndex > newEdit.oldEndIndex;

        if (lastAdd !== newAdd) return false;

        if (newAdd) {
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
        else {
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

        for (const change of this._currentChanges) {
            let updated = false;
            let changedNode: CacheNode | undefined;
            let affectedParentNode: FolderNode | undefined;

            const { operation, path } = change;
            switch (operation) {
                case Operation.Delete:
                    [updated, changedNode, affectedParentNode] = this._delete(path);
                    break;
                case Operation.Modify:
                    this._modify(path, change.content, change.edits);
                    break;
                case Operation.Rename:
                    updated = this._rename(path, change.newName);
                    break;
                case Operation.Move:
                    [updated, changedNode, affectedParentNode] = this._move(path, change.newDir);
                    break;
            }

            if (updated) this._vizEngine.update(changedNode, affectedParentNode);
        }

        this._currentChanges = [];

        if (this._pendingChanges.length) this._debouncer.schedule(() => this._processChanges());
    }

    private _delete(path: string): [boolean, CacheNode | undefined, FolderNode | undefined] {
        const node = this._findNode(path);
        const parent = node?.parent;
        node?.delete();
        return [!!node, node, parent];
    }

    private _modify(path: string, content: string, edits: Edit[]): void {
        // if node exists in cache, 50/50 has lru cache
        // if not, definitely not in cache and need to create new tree
        const node = this._findNode(path) as FileNode ?? this._createFileNode(path);
        node.updated = true;
        const oldTree = this._cache.get(node);
        const tree = oldTree ?
            this._analyzer.updateTree(oldTree, edits, content) :
            this._analyzer.getTree(content);

        this._cache.set(node, tree);
        this._processNode(node, tree);
    }

    private _rename(path: string, newName: string): boolean {
        const node = this._findNode(path);
        node?.setName(newName);
        return !!node;
    }

    private _move(path: string, newDir: string): [boolean, CacheNode | undefined, FolderNode | undefined] {
        const node = this._findNode(path);
        const parent = node?.parent;
        node?.setParent(this._createFolderNode(newDir.split(sep)));
        return [!!node, node, parent];
    }

    private _findNode(path: string): CacheNode | undefined {
        if (!path) return this.root;

        let current = this.root;
        const parts = path.split(sep);
        const last = parts.pop()!;

        for (const part of parts) {
            const next = current.children.get(part) as FolderNode;
            if (!next) return;
            current = next;
        }

        return current.children.get(last);
    }

    private _createFileNode(path: string): FileNode {
        const parts = path.split(sep);
        const name = parts.pop()!;
        const parent = this._createFolderNode(parts);
        return new FileNode(name, parent);
    }

    private _createFolderNode(parts: string[]): FolderNode {
        let current = this.root;

        for (const part of parts) {
            const next = current.children.get(part) as FolderNode;
            current = next ?? new FolderNode(part, current);
        }

        return current;
    }

    private _processNode(node: FileNode, tree: Tree): void {
        const process = (this._processingNodes.get(node) ?? Promise.resolve())
            .then(() => {
                if (!node.parent || !node.updated) return;
                return this._analyzer.processTree(tree, node.data);
            })
            .then(updated => {
                if (!updated) return;
                this._vizEngine.update(node, node.parent);
            })
            .catch(error => Logger.error(error, 'CacheManager'))
            .finally(() => {
                if (this._processingNodes.get(node) === process)
                    this._processingNodes.delete(node);
            });

        this._processingNodes.set(node, process);
    }

    private _getNewCache(): LRUCache<FileNode, Tree> {
        return new LRUCache<FileNode, Tree>({
            max: getConfigValue<number>(ConfigSection.MaxCacheSize),
            noDisposeOnSet: true,
            dispose: (_, node): void => { if (!this._vizEngine.isActive) node.clear(); }
        });
    }
}
