import Java from 'tree-sitter-java';
import { Analyzer } from "./Analyzer";


export class JavaAnalyzer extends Analyzer {
    public constructor() {
        super();
        this._parser.setLanguage(Java);
    }
}
