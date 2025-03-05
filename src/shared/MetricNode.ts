export abstract class MetricNode {
    public totalLOC: number = 0;
    public commentLOC: number = 0;
    public commentDensity: number = 0;

    public constructor(
        public name: string = ''
    ) { }
}


export class FolderMetricNode extends MetricNode {
    public children: Record<string, MetricNode> = {};
    public totalTypes: number = 0;
    public abstractTypes: number = 0;
    public abstractness: number = 0;

    public addChild(name: string, node: MetricNode): void {
        this.children[name] = node;
    }

    public removeChild(name: string): void {
        delete this.children[name];
    }

    public renameChild(oldName: string, newName: string): void {
        this.children[newName] = this.children[oldName];
        delete this.children[oldName];
    }

    public moveChild(name: string, newParent: FolderMetricNode | undefined): void {
        newParent?.addChild(name, this.children[name]);
        delete this.children[name];
    }
}


export class FileMetricNode extends MetricNode {
    public types: Record<string, TypeMetric> = {};
}


type TypeMetric = {
    fieldCount: number,
    methodCount: number
};
