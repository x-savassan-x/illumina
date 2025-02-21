import { FileData } from "./FileData";
import { MetricNode, FolderMetricNode, FileMetricNode } from "@shared/types/metrics";


export abstract class CacheNode<M extends MetricNode = MetricNode> {
    public constructor(
        public name: string,
        public metricNode: M,
        public parent?: FolderNode,
    ) {
        this.parent?.children.set(this.name, this);
    }

    public delete(): void {
        this.metricNode.delete();
        this.parent?.children.delete(this.name);
        this.parent = undefined;
    }

    public setName(newName: string): void {
        this.metricNode.setName(newName);
        this.parent?.children.delete(this.name);
        this.parent?.children.set(newName, this);
        this.name = newName;
    }

    public setParent(newParent: FolderNode | undefined): void {
        this.metricNode.setParent(newParent?.metricNode);
        this.parent?.children.delete(this.name);
        newParent?.children.set(this.name, this);
        this.parent = newParent;
    }
}


export class FolderNode extends CacheNode<FolderMetricNode> {
    public readonly children: Map<string, CacheNode> = new Map();

    public constructor(name: string, parent?: FolderNode) {
        super(name, new FolderMetricNode(name, parent?.metricNode), parent);
    }

    public override delete(): void {
        for (const child of this.children.values())
            child.delete();
        super.delete();
    }
}


export class FileNode extends CacheNode<FileMetricNode> {
    public updated: boolean = false;
    public readonly data: FileData[] = [];

    public constructor(name: string, parent?: FolderNode) {
        super(name, new FileMetricNode(name, parent?.metricNode), parent);
    }

    public clear(): void {
        this.updated = false;
        this.data.length = 0;
    }
}
