import { workspace, Disposable } from "vscode";
import { sep } from "path";
import { LRUCache } from "lru-cache";
import { Tree, Edit } from "tree-sitter";
import { Operation, Change } from "./Change";
import { Debouncer } from "./Debouncer";
import { CacheNode, FolderNode, FileNode, Analyzer, getAnalyzer } from "@core/index";
import { ConfigSection, getConfigValue, handleConfigChanges } from "@ext/config";
import { Logger } from "@ext/Logger";


export class CacheManager {
    private static _instance: CacheManager | undefined;
    private readonly _root: FolderNode;
    private readonly _debouncer: Debouncer;
    private readonly _configChangeHandler: Disposable;
    private readonly _processingNodes = new Map<FileNode, Promise<void>>();
    private _cache: LRUCache<FileNode, Tree>;
    private _pendingChanges: Change[] = [];
    private _currentChanges: Change[] = [];
    private _analyzer: Analyzer;

    private constructor() {
        this._root = new FolderNode();
        this._cache = this._getNewCache();
        this._analyzer = getAnalyzer(getConfigValue<string>(ConfigSection.SourceLanguage));
        this._debouncer = new Debouncer();
        this._configChangeHandler = workspace.onDidChangeConfiguration(e => handleConfigChanges(e, [
            [[ConfigSection.SourceDirectory, ConfigSection.SourceLanguage], (): void => {
                this._root.children.clear();
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

    public get root(): FolderNode {
        return this._root;
    }

    public handleChange(change: Change): void {
        if (!this._tryMerge(change))
            this._pendingChanges.push(change);
        this._debouncer.schedule(() => this._processChanges());
    }

    public dispose(): void {
        this._configChangeHandler.dispose();
        this._debouncer.dispose();
        CacheManager._instance = undefined;
    }

    private _tryMerge(newChange: Change): boolean {
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

        this._currentChanges = [...this._pendingChanges];
        this._pendingChanges = [];

        for (const change of this._currentChanges) {
            switch (change.operation) {
                case Operation.Delete:
                    this._delete(change.path);
                    break;
                case Operation.Modify:
                    this._modify(change.path, change.content, change.edits);
                    break;
                case Operation.Rename:
                    this._rename(change.path, change.newName);
                    break;
                case Operation.Move:
                    this._move(change.path, change.newDir);
                    break;
            }
        }

        this._currentChanges = [];

        if (this._pendingChanges.length)
            this._debouncer.schedule(() => this._processChanges());
    }

    private _delete(path: string): void {
        Logger.debug(`Delete ${path}`);
        this._findNode(path)?.delete();
    }

    private _modify(path: string, content: string, edits: Edit[]): void {
        Logger.debug(`Modify ${path}`);
        // if node exists in cache, 50/50 has lru cache
        // if not, need to create new tree
        const node = this._findNode(path) as FileNode ?? this._createFileNode(path);
        node.updated = true;
        const oldTree = this._cache.get(node);
        const tree = oldTree ?
            this._analyzer.updateTree(oldTree, edits, content) :
            this._analyzer.getTree(content);

        this._cache.set(node, tree);

        const prevProcess = this._processingNodes.get(node);

        const nextProcess = (prevProcess ?? Promise.resolve())
        .then(() => {
            if (!node.parent || !node.updated) return;
            return this._analyzer.processTree(tree, node.data);
        })
        .then(isUpdated => {
            if (isUpdated)
                Logger.debug(`Updated ${path}\n${node.data.join('\n')}`);
        })
        .catch(error => Logger.error(error, 'CacheManager'))
        .finally(() => {
            if (this._processingNodes.get(node) === nextProcess)
                this._processingNodes.delete(node);
        });

        this._processingNodes.set(node, nextProcess);
    }

    private _rename(path: string, newName: string): void {
        Logger.debug(`Rename ${path} to ${newName}`);
        this._findNode(path)?.setName(newName);
    }

    private _move(path: string, newDir: string): void {
        Logger.debug(`Move ${path} to ${newDir}`);
        const newParent = this._setupFolder(newDir.split(sep));
        this._findNode(path)?.setParent(newParent);
    }

    private _findNode(path: string): CacheNode | undefined {
        if (!path) return this._root;

        let current = this._root;
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
        const parent = this._setupFolder(parts);
        return new FileNode(name, parent);
    }

    private _setupFolder(parts: string[]): FolderNode {
        let current = this._root;

        for (const part of parts) {
            const next = current.children.get(part) as FolderNode;
            current = next ?? new FolderNode(part, current);
        }

        return current;
    }

    private _getNewCache(): LRUCache<FileNode, Tree> {
        return new LRUCache<FileNode, Tree>({
            max: getConfigValue<number>(ConfigSection.MaxCacheSize),
            noDisposeOnSet: true,
            dispose: (_, node): void => {
                node.updated = false;
                node.data.length = 0;
            }
        });
    }
}
