import Parser, { Tree, Edit } from "tree-sitter";
import { FileData } from "@core/index";


export abstract class Analyzer {
    protected readonly _parser: Parser = new Parser();

    public constructor(language: unknown) {
        this._parser.setLanguage(language);
    }

    public getTree(srcCode: string): Tree {
        return this._parser.parse(srcCode);
    }

    public updateTree(oldTree: Tree, edits: Edit[], newSrcCode: string): Tree {
        edits.forEach(edit => oldTree.edit(edit));
        return this._parser.parse(newSrcCode, oldTree);
    }

    public abstract processTree(tree: Tree, data: FileData[]): Promise<boolean>;

    protected _hasError(tree: Tree): boolean {
        return tree.rootNode.hasError;
    }
}
