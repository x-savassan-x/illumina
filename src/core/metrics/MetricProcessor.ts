import {
    MetricCalculator,
    LOCMetric,
    CommentDensityMetric
} from "./MetricCalculator";
import { CacheNode } from "@core/cache/CacheNode";

export class MetricsProcessor {
    private readonly _calculators: MetricCalculator[] = [
        new LOCMetric(),
        new CommentDensityMetric(),
    ];

    public async process(node: CacheNode): Promise<void> {
        await Promise.all(this._calculators.map(calculator => calculator.calculate(node)));
    }
}
