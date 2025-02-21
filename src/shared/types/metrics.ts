export abstract class MetricNode {
    public loc: number = 0;
    public commentDensity: number = 0;

    public constructor(
        public name: string = '',
        public parent?: FolderMetricNode
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

    public setParent(newParent: FolderMetricNode | undefined): void {
        this.parent?.children.delete(this.name);
        newParent?.children.set(this.name, this);
        this.parent = newParent;
    }
}

export class FolderMetricNode extends MetricNode {
    public readonly children: Map<string, MetricNode> = new Map();
}

export class FileMetricNode extends MetricNode {}