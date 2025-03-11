import Parser, { Tree, Edit } from "tree-sitter";
import { FileNode } from "@core/index";


export abstract class Analyzer {
    protected readonly _parser: Parser = new Parser();
    private readonly _BYTES_PER_CHAR = 2;

    public constructor(language: unknown) {
        this._parser.setLanguage(language);
    }

    public getTree(srcCode: string): Tree {
        return this._parser.parse(srcCode, undefined, {
            bufferSize: this._getBufferSize(srcCode)
        });
    }

    public updateTree(oldTree: Tree, edits: Edit[], newSrcCode: string): Tree {
        edits.forEach(edit => oldTree.edit(edit));
        return this._parser.parse(newSrcCode, oldTree, {
            bufferSize: this._getBufferSize(newSrcCode)
        });
    }

    public abstract processTree(tree: Tree, node: FileNode): Promise<boolean>;

    protected _hasError(tree: Tree): boolean {
        return tree.rootNode.hasError;
    }

    private _getBufferSize(srcCode: string): number {
        return srcCode.length * this._BYTES_PER_CHAR * 1.5;
    }
}
