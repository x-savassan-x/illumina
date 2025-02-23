import { Analyzer } from './analyzers/Analyzer';
import { JavaAnalyzer } from './analyzers/JavaAnalyzer';


export { Analyzer };
export { CacheNode, FolderNode, FileNode} from './cache/CacheNode';
export {
    FileData,
    GeneralData,
    ImportData,
    TypeData,
    VariableData,
    FunctionData
} from './cache/FileData';
export { MetricsProcessor } from './metrics/MetricProcessor';


export function getAnalyzer(language: string): Analyzer {
    switch (language) {
        case '.java':
            return new JavaAnalyzer();
        default:
            throw new Error(`Unsupported language: ${language}`);
    }
}
