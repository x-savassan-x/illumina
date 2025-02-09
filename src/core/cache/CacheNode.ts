import { FileData } from "./FileData";


export abstract class CacheNode {
    public constructor(
        public name: string = '',
        public parent?: FolderNode
    ) {
        this.parent?.children.set(this.name, this);
    }

    public delete(): void {
        this.parent?.children.delete(this.name);
        this.parent = undefined;
    }

    public setName(newName: string): void {
        this.parent?.children.delete(this.name);
        this.parent?.children.set(newName, this);
        this.name = newName;
    }

    public setParent(newParent: FolderNode | undefined): void {
        this.parent?.children.delete(this.name);
        newParent?.children.set(this.name, this);
        this.parent = newParent;
    }
}


export class FolderNode extends CacheNode {
    public readonly children: Map<string, CacheNode> = new Map();

    public override delete(): void {
        for (const child of this.children.values()) {
            child.delete();
        }
        super.delete();
    }
}


export class FileNode extends CacheNode {
    public updated: boolean = false;
    public readonly data: FileData[] = [];
}
