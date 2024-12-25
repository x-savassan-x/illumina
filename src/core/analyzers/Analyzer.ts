import Parser, { Tree, Edit } from "tree-sitter";


export abstract class Analyzer {
    protected readonly _parser: Parser = new Parser();

    public parse(sourceCode: string): Tree {
        return this._parser.parse(sourceCode);
    }

    public update(tree: Tree, edits: Edit[], sourceCode: string): Tree {
        edits.forEach(edit => tree.edit(edit));
        return this._parser.parse(sourceCode, tree);
    }
}
