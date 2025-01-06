import { Tree } from "tree-sitter";
import { Analyzer } from "@core/analyzers";


export abstract class TreeNode {
    public constructor(
        private _name: string,
        private _parent?: FolderNode
    ) {}

    public delete(): void {
        this._parent?.children.delete(this._name);
    }

    public get name(): string {
        return this._name;
    }
    
    public set name(value: string) {
        this._parent?.children.delete(this._name);
        this._parent?.children.set(value, this);
        this._name = value;
    }

    public get parent(): FolderNode | undefined {
        return this._parent;
    }

    public set parent(value: FolderNode | undefined) {
        this._parent?.children.delete(this._name);
        value?.children.set(this._name, this);
        this._parent = value;
    }
}


export class FolderNode extends TreeNode {
    public readonly children: Map<string, TreeNode> = new Map();
}


export class FileNode extends TreeNode {
    public updateData(tree: Tree, analyzer: Analyzer): void {}
}
