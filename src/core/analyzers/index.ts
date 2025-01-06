import { Analyzer } from "./Analyzer";
import { JavaAnalyzer } from "./JavaAnalyzer";


export { Analyzer } from './Analyzer';

export function getAnalyzer(language: string): Analyzer {
    switch (language) {
        case '.java':
            return new JavaAnalyzer();
        default:
            throw new Error(`Unsupported language: ${language}`);
    }
}