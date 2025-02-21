import {
    CacheNode,
    FolderNode,
    FileNode,
    GeneralData,
} from "@core/index";


export interface MetricCalculator {
    calculate(root: CacheNode): Promise<void>;
}


export class LOCMetric implements MetricCalculator {
    public async calculate(node: CacheNode): Promise<void> {
        // if (node instanceof FileNode) {
        //     const generalData = node.data.find(d => d instanceof GeneralData) as GeneralData;
        //     node.metricNode.loc = generalData?.totalLOC ?? 0;
        // }
        // else if (node instanceof FolderNode) {
        //     let total = 0;
        //     for (const child of node.children.values()) {
        //         await this.calculate(child);
        //         total += child.metricNode.loc;
        //     }
        //     node.metricNode.loc = total;
        // }
    }
}


export class CommentDensityMetric implements MetricCalculator {
    public async calculate(node: CacheNode): Promise<void> {
        // if (node instanceof FileNode) {
        //     const generalData = node.data.find(d => d instanceof GeneralData) as GeneralData;
        //     if (!generalData || generalData.totalLOC === 0) {
        //         node.metricNode.commentDensity = 0;
        //         return;
        //     }
        //     node.metricNode.commentDensity = (generalData.commentLOC / generalData.totalLOC) * 100;
        // }
        // else if (node instanceof FolderNode) {
        //     let totalLOC = 0;
        //     let totalCommentLOC = 0;

        //     const processFolder = (folderNode: FolderNode): void => {
        //         folderNode.children.forEach(child => {
        //             if (child instanceof FileNode) {
        //                 const generalData = child.data.find(d => d instanceof GeneralData) as GeneralData;
        //                 if (generalData) {
        //                     totalLOC += generalData.totalLOC;
        //                     totalCommentLOC += generalData.commentLOC;
        //                 }
        //             }
        //             else if (child instanceof FolderNode) {
        //                 processFolder(child);
        //             }
        //         });
        //     };

        //     processFolder(node);

        //     node.metricNode.commentDensity = totalLOC === 0 ? 0 : (totalCommentLOC / totalLOC) * 100;
        // }
    }
}
