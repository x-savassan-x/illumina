export abstract class MetricNode {
    public lines = 0;
    public linesOfCode = 0;
    public commentDensity = 0;

    public commentLines = 0;
    public height = 0;
    public leafCount = 1;

    public constructor(
        public name: string = ''
    ) { }
}


export class FolderMetricNode extends MetricNode {
    public abstractness = 0;

    public children: Record<string, MetricNode> = {};
    public totalTypes = 0;
    public abstractTypes = 0;

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
    public weightedMethodCount = 0;
}
