import {
    CacheNode,
    FolderNode,
    FileNode,
    GeneralData,
    TypeData,
    FunctionWeightData
} from "@core/index";


export abstract class MetricCalculator {
    public abstract calculate(root: CacheNode, recalculated?: boolean): Promise<boolean>;
    public async recalculate(start: CacheNode, end?: FolderNode): Promise<void> {
        let current: CacheNode | undefined = start;
        while (current && current !== end) {
            const changed = await this.calculate(current, true);
            if (!changed) break;
            current = current.parent;
        }
    }
}


export class GeneralMetric extends MetricCalculator {
    public async calculate(node: CacheNode, recalculated?: boolean): Promise<boolean> {
        const metricNode = node.metricNode;
        let lines = 0;
        let linesOfCode = 0;
        let commentLines = 0;
        let height = 0;
        let leafCount = 0;
        if (node instanceof FileNode) {
            const generalData = node.data.find(d => d instanceof GeneralData)!;

            lines = generalData.lines;
            linesOfCode = generalData.linesOfCode;

            commentLines = generalData.commentLines;
            leafCount = 1;
        }
        else if (node instanceof FolderNode) {
            for (const child of node.children.values()) {
                if (!recalculated) await this.calculate(child);

                lines += child.metricNode.lines;
                linesOfCode += child.metricNode.linesOfCode;

                commentLines += child.metricNode.commentLines;
                height = Math.max(height, child.metricNode.height + 1);
                leafCount += child.metricNode.leafCount;
            }
        }

        if (recalculated
            && metricNode.lines === lines
            && metricNode.linesOfCode === linesOfCode
            && metricNode.commentLines === commentLines
            && metricNode.height === height
            && metricNode.leafCount === leafCount
        ) return false;

        metricNode.lines = lines;
        metricNode.linesOfCode = linesOfCode;
        const nonBlankLines = linesOfCode + commentLines;
        metricNode.commentDensity = nonBlankLines ? commentLines / nonBlankLines : 0;

        metricNode.commentLines = commentLines;
        metricNode.height = height;
        metricNode.leafCount = leafCount;

        return true;
    }
}


export class AbstractnessMetric extends MetricCalculator {
    public async calculate(node: CacheNode, recalculated?: boolean): Promise<boolean> {
        if (node instanceof FileNode) return true;

        const folderNode = node as FolderNode;
        const metricNode = folderNode.metricNode;
        let totalTypes = 0;
        let abstractTypes = 0;

        for (const child of folderNode.children.values()) {
            if (child instanceof FileNode) {
                const typesData = child.data.filter(d => d instanceof TypeData);
                totalTypes += typesData.length;
                abstractTypes += typesData.filter(
                    d => d.modifiers.has('abstract')
                        || d.kind === 'interface'
                ).length;
            }
            else if (child instanceof FolderNode) {
                if (!recalculated) await this.calculate(child);
                totalTypes += child.metricNode.totalTypes;
                abstractTypes += child.metricNode.abstractTypes;
            }
        }

        if (recalculated
            && metricNode.totalTypes === totalTypes
            && metricNode.abstractTypes === abstractTypes
        ) return false;

        metricNode.totalTypes = totalTypes;
        metricNode.abstractTypes = abstractTypes;
        metricNode.abstractness = totalTypes ? abstractTypes / totalTypes : 0;

        return true;
    }
}


export class WeightedMethodCountMetric extends MetricCalculator {
    public async calculate(node: CacheNode, recalculated?: boolean): Promise<boolean> {
        if (recalculated && node instanceof FolderNode) return false;

        if (node instanceof FileNode) {
            const metricNode = node.metricNode;
            const weightData = node.data.filter(d => d instanceof FunctionWeightData);
            metricNode.weightedMethodCount = weightData.reduce((acc, d) => acc + d.weight, 0);
        }
        else if (node instanceof FolderNode) {
            for (const child of node.children.values())
                await this.calculate(child);
        }

        return true;
    }
}
