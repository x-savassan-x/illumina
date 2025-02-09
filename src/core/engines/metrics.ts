import {
    CacheNode,
    FolderNode,
    FileNode,
    FileData,
    GeneralData,
    ImportData,
    TypeData,
    FunctionData,
    VariableData 
} from "@core/index";


export interface MetricCalculator {
    calculate(root: CacheNode): Record<string, number>;
}


export class LOCMetric implements MetricCalculator {
    public calculate(root: CacheNode): Record<string, number> {
        return {};
    }
}


export class CommentDensityMetric implements MetricCalculator {
    public calculate(root: CacheNode): Record<string, number> {
        return {};
    }
}


export class InstabilityMetric implements MetricCalculator {
    public calculate(root: CacheNode): Record<string, number> {
        return {};
    }
}


export class AbstractnessMetric implements MetricCalculator {
    public calculate(root: CacheNode): Record<string, number> {
        return {};
    }
}


export class FieldCountMetric implements MetricCalculator {
    public calculate(root: CacheNode): Record<string, number> {
        return {};
    }
}


export class MethodCountMetric implements MetricCalculator {
    public calculate(root: CacheNode): Record<string, number> {
        return {};
    }
}


export enum MetricGranularity { CrossCutting, Package, Class }


export const MetricRegistry = {
    [MetricGranularity.CrossCutting]: [
        LOCMetric,
        CommentDensityMetric
    ],
    [MetricGranularity.Package]: [
        InstabilityMetric,
        AbstractnessMetric
    ],
    [MetricGranularity.Class]: [
        FieldCountMetric,
        MethodCountMetric
    ]
};