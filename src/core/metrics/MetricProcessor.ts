import {
    MetricCalculator,
    GeneralMetric,
    AbstractnessMetric,
    WeightedMethodCountMetric
} from "./MetricCalculator";
import { CacheNode, FolderNode } from "@core/cache/CacheNode";


export class MetricsProcessor {
    private readonly _calculators: MetricCalculator[] = [
        new GeneralMetric(),
        new AbstractnessMetric(),
        new WeightedMethodCountMetric(),
    ];

    public async calculate(node: CacheNode): Promise<void> {
        await Promise.all(this._calculators.map(calculator => calculator.calculate(node)));
    }

    public async recalculate(changedNode: CacheNode, affectedParentNode?: FolderNode): Promise<void> {
        const [start1, start2] = this._findStartPoint(changedNode, affectedParentNode);
        const end = this._findEndpoint(changedNode.parent, affectedParentNode);
        const path1 = this._calculators.map(calculator => calculator.recalculate(start1, end));
        const path2 = start2 ? this._calculators.map(calculator => calculator.recalculate(start2, end)) : [];
        await Promise.all(path1.concat(path2));
    }

    private _findStartPoint(
        changedNode: CacheNode,
        affectedParentNode?: FolderNode
    ): [CacheNode, CacheNode | undefined] {
        if (changedNode.parent === affectedParentNode) return [changedNode, undefined];
        if (!changedNode.parent) return [affectedParentNode!, undefined];
        return [changedNode.parent, affectedParentNode];
    }

    private _findEndpoint(parent1?: FolderNode, parent2?: FolderNode): FolderNode | undefined {
        if(!parent1 || !parent2 || parent1 === parent2) return;

        const path1: Set<FolderNode> = new Set();
        let current: FolderNode | undefined = parent1;
        while (current) {
            path1.add(current);
            current = current.parent;
        }

        current = parent2;
        while (current) {
            if (path1.has(current)) return current;
            current = current.parent;
        }

        return undefined;
    }
}
