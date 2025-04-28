import { workspace, Disposable, Uri, EventEmitter } from "vscode";
import { sep } from "path";
import { LRUCache } from "lru-cache";
import { Tree, Edit } from "tree-sitter";
import { Operation, Change } from "./Change";
import { CacheNode, FolderNode, FileNode, getAnalyzer } from "@core/index";
import { ConfigSection, getConfigValue, handleConfigChanges } from "@ext/config";
import { Logger } from "@ext/Logger";


export class CacheManager {
    public static readonly isActive = (): boolean => !!this._instance;
    public readonly updateEmitter = new EventEmitter<[CacheNode | undefined, FolderNode | undefined]>();
    public cacheRoot = new FolderNode(getConfigValue<string>(ConfigSection.SourceDirectory));
    private static _instance: CacheManager | undefined;
    private readonly _processingNodes = new Map<FileNode, Promise<void>>();
    private readonly _disposable: Disposable;
    private _lruCache = this._getNewLRUCache();
    private _analyzer = getAnalyzer(getConfigValue<string>(ConfigSection.SourceLanguage));

    private constructor() {
        this._disposable = workspace.onDidChangeConfiguration(e => handleConfigChanges(e, [
            [[
                ConfigSection.SourceDirectory,
                ConfigSection.SourceLanguage,
                ConfigSection.IgnoredFiles
            ], (): void => {
                this.cacheRoot = new FolderNode(getConfigValue<string>(ConfigSection.SourceDirectory));
                this._lruCache.clear();
            }],
            [[ConfigSection.SourceLanguage], (): void => {
                this._analyzer = getAnalyzer(getConfigValue<string>(ConfigSection.SourceLanguage));
            }],
            [[ConfigSection.MaxCacheSize], (): void => {
                const cache = this._getNewLRUCache();
                this._lruCache.forEach((tree, node) => cache.set(node, tree));
                this._lruCache = cache;
            }]
        ]));

        Logger.info('CacheManager initialized');
    }

    public static get instance(): CacheManager {
        this._instance ??= new CacheManager();
        return this._instance;
    }

    public handleChanges(changes: Change[]): void {
        for (const change of changes) {
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

            if (updated) this.updateEmitter.fire([changedNode, affectedParentNode]);
        }
    }

    public async ensureNode(data: [string, Uri]): Promise<void> {
        const [path, uri] = data;
        let node = this._findNode(path) as FileNode;
        if (node) return;

        node = this._createFileNode(path);
        const bytes = await workspace.fs.readFile(uri);
        const content = new TextDecoder().decode(bytes);
        const tree = this._analyzer.getTree(content);

        if (this._lruCache.size < this._lruCache.max) this._lruCache.set(node, tree);
        this._processNode(node, tree);
    }

    public async waitProcessingNodes(): Promise<void> {
        await Promise.all(this._processingNodes.values());
    }

    public dispose(): void {
        this.updateEmitter.dispose();
        this._disposable.dispose();
        CacheManager._instance = undefined;
    }

    private _delete(path: string): [boolean, CacheNode | undefined, FolderNode | undefined] {
        Logger.info(`Delete ${path}`);
        const node = this._findNode(path);
        const parent = node?.parent;
        node?.delete();
        return [!!node, node, parent];
    }

    private _modify(path: string, content: string, edits: Edit[]): void {
        Logger.info(`Modify ${path}`);
        // if node exists in cache, 50/50 has lru cache
        // if not, definitely not in lru cache and need to create new AST
        const node = this._findNode(path) as FileNode ?? this._createFileNode(path);
        const oldTree = this._lruCache.get(node);
        const tree = oldTree ?
            this._analyzer.updateTree(oldTree, edits, content) :
            this._analyzer.getTree(content);

        this._lruCache.set(node, tree);
        this._processNode(node, tree);
    }

    private _rename(path: string, newName: string): boolean {
        Logger.info(`Rename ${path} to ${newName}`);
        const node = this._findNode(path);
        node?.setName(newName);
        return !!node;
    }

    private _move(path: string, newDir: string): [boolean, CacheNode | undefined, FolderNode | undefined] {
        Logger.info(`Move ${path} to ${newDir}`);
        const node = this._findNode(path);
        const parent = node?.parent;
        node?.setParent(this._createFolderNode(newDir.split(sep)));
        return [!!node, node, parent];
    }

    private _findNode(path: string): CacheNode | undefined {
        if (!path) return this.cacheRoot;

        let current = this.cacheRoot;
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
        let current = this.cacheRoot;

        for (const part of parts) {
            const next = current.children.get(part) as FolderNode;
            current = next ?? new FolderNode(part, current);
        }

        return current;
    }

    private _processNode(node: FileNode, tree: Tree): void {
        const process = (this._processingNodes.get(node) ?? Promise.resolve())
            .then(() => {
                if (!node.parent) return;
                return this._analyzer.processTree(tree, node);
            })
            .then(updated => { if (updated) this.updateEmitter.fire([node, node.parent]);})
            .catch(error => Logger.error(error, 'CacheManager'))
            .finally(() => {
                if (this._processingNodes.get(node) === process)
                    this._processingNodes.delete(node);
            });

        this._processingNodes.set(node, process);
    }

    private _getNewLRUCache(): LRUCache<FileNode, Tree> {
        return new LRUCache<FileNode, Tree>({
            max: getConfigValue<number>(ConfigSection.MaxCacheSize)
        });
    }
}
