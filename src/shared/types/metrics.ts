export abstract class MetricNode {
    public totalLOC: number = 0;
    public commentLOC: number = 0;
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
    public totalTypes: number = 0;
    public abstractTypes: number = 0;
    public abstractness: number = 0;
}


export class FileMetricNode extends MetricNode {
    public readonly types: Map<string, TypeMetric> = new Map();
}


type TypeMetric = {
    fieldCount: number,
    methodCount: number
};
