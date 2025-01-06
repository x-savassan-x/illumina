import Parser, { Tree, Edit } from "tree-sitter";


export abstract class Analyzer {
    protected readonly _parser: Parser = new Parser();

    public getTree(srcCode: string): Tree {
        return this._parser.parse(srcCode);
    }

    public updateTree(oldTree: Tree, edits: Edit[], newSrcCode: string): Tree {
        edits.forEach(edit => oldTree.edit(edit));
        return this._parser.parse(newSrcCode, oldTree);
    }
}
