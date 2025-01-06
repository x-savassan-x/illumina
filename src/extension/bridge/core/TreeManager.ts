import { workspace, Disposable } from "vscode";
import { sep } from "path";
import { LRUCache } from "lru-cache";
import { Tree, Edit } from "tree-sitter";
import { Operation, Change } from "./Change";
import { TreeNode, FolderNode, FileNode } from "@core/models";
import { Analyzer, getAnalyzer } from "@core/analyzers";
import { ConfigSection, handleConfigChanges, getConfigValue } from "../../config";
import { Logger } from "../../Logger";


export class TreeManager {
    private static _root: FolderNode;
    private _cache: LRUCache<FileNode, Tree>;
    private _analyzer: Analyzer;
    private readonly _configChangeHandler: Disposable;

    public constructor() {
        TreeManager._root = new FolderNode(getConfigValue<string>(ConfigSection.SourceDirectory));
        this._cache = new LRUCache({
            max: getConfigValue<number>(ConfigSection.MaxCacheSize),
            dispose: (_, node): void => node.delete(),
        });
        this._analyzer = getAnalyzer(getConfigValue<string>(ConfigSection.SourceLanguage));
        this._configChangeHandler = workspace.onDidChangeConfiguration(e => handleConfigChanges(e, [
            [ConfigSection.SourceDirectory, (): void => {
                TreeManager._root = new FolderNode(getConfigValue<string>(ConfigSection.SourceDirectory));
                this._cache.clear();
            }],
            [ConfigSection.MaxCacheSize, (): void => {
                const cache = new LRUCache<FileNode, Tree>({
                    max: getConfigValue<number>(ConfigSection.MaxCacheSize),
                    dispose: (_, node): void => node.delete(),
                });
                this._cache.forEach((tree, node) => cache.set(node, tree));
                this._cache = cache;
            }],
            [ConfigSection.SourceLanguage, (): void => {
                TreeManager._root = new FolderNode(getConfigValue<string>(ConfigSection.SourceDirectory));
                this._cache.clear();
                this._analyzer = getAnalyzer(getConfigValue<string>(ConfigSection.SourceLanguage));
            }]
        ]));
    }

    public handleChange(change: Change): void {
        switch (change.operation) {
            case Operation.Delete:
                Logger.debug(`Deleted file/folder: ${change.path}`);
                this._delete(change.path);
                break;
            case Operation.Modify:
                Logger.debug(`Modified file: ${change.path}`, undefined, { edits: change.edits });
                this._modify(change.path, change.content, change.edits);
                break;
            case Operation.Rename:
                Logger.debug(`Renamed file/folder: ${change.path}`, undefined, { newName: change.newName });
                this._rename(change.path, change.newName);
                break;
            case Operation.Move:
                Logger.debug(`Moved file/folder: ${change.path}`, undefined, { newDir: change.newDir });
                this._move(change.path, change.newDir);
                break;
        }
    }

    public dispose(): void {
        this._configChangeHandler.dispose();
    }

    private _delete(path: string): void {
        const node = this._findNode(path);
        if (node) {
            if (node instanceof FileNode) {
                this._cache.delete(node);
            }
            node.delete();
        }
    }

    private _modify(path: string, content: string, edits: Edit[]): void {
        let node = this._findNode(path) as FileNode;
        if (node && this._cache.has(node)) {
            const oldTree = this._cache.get(node)!;
            const newTree = this._analyzer.updateTree(oldTree, edits, content);
            this._cache.set(node, newTree);
            node.updateData(newTree, this._analyzer);
        }
        else {
            if (!node) {
                node = this._createFileNode(path);
            }
            const tree = this._analyzer.getTree(content);
            this._cache.set(node, tree);
            node.updateData(tree, this._analyzer);
        }
    }

    private _rename(path: string, newName: string): void {
        const node = this._findNode(path);
        if (node) {
            node.name = newName;
        }
    }

    private _move(path: string, newDir: string): void {
        const node = this._findNode(path);
        if (node) {
            const parts = newDir.split(sep);
            node.parent = this._ensureFolderPath(parts);
        }
    }

    private _findNode(path: string): TreeNode | undefined {
        const parts = path.split(sep);
        let current: TreeNode | undefined = TreeManager._root;

        for (let i = TreeManager._root.name ? 1 : 0; current && i < parts.length; i++) {
            current = (current as FolderNode).children.get(parts[i]);
        }

        return current;
    }

    private _createFileNode(path: string): FileNode {
        const parts = path.split(sep);
        const name = parts.pop()!;
        const parentNode = this._ensureFolderPath(parts);

        const node = new FileNode(name, parentNode);
        parentNode.children.set(name, node);
        return node;
    }

    private _ensureFolderPath(parts: string[]): FolderNode {
        let current = TreeManager._root;

        for (let i = TreeManager._root.name ? 1 : 0; i < parts.length; i++) {
            const part = parts[i];
            let next = current.children.get(part) as FolderNode;

            if (!next) {
                next = new FolderNode(part, current);
                current.children.set(part, next);
            }

            current = next;
        }

        return current;
    }
}
