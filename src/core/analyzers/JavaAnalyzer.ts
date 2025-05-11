import { Tree, Query } from 'tree-sitter';
import Java from 'tree-sitter-java';
import { Analyzer } from "./Analyzer";
import {
    FileNode,
    GeneralData,
    TypeData,
    FunctionWeightData
} from "@core/index";


export class JavaAnalyzer extends Analyzer {
    private readonly _typeDeclQuery: Query = new Query(Java, `
        (class_declaration
            (modifiers)? @type_modifiers
            (identifier) @type_name
        ) @class

        (interface_declaration
            (modifiers)? @type_modifiers
            (identifier) @type_name
        ) @interface
    `);
    private readonly _methodQuery = new Query(Java, `
        (method_declaration
            name: (identifier) @name
        ) @method

        (constructor_declaration
            name: (identifier) @name
        ) @method
    `);

    public constructor() { super(Java); }

    public override async processTree(tree: Tree, node: FileNode): Promise<boolean> {
        if (this._hasError(tree)) return false;

        const [generalData, typeData, functionWeightData] = await Promise.all([
            this._processGeneralData(tree),
            this._processTypeData(tree),
            this._processFunctionWeights(tree)
        ]);

        const data = node.data;
        data.length = 0;
        data.push(generalData, ...typeData, ...functionWeightData);

        return true;
    }

    private async _processGeneralData(tree: Tree): Promise<GeneralData> {
        const totalLines = tree.rootNode.endPosition.row + 1;
        let linesOfCode = 0;
        let commentLines = 0;

        const srcLines = tree.rootNode.text.split('\n');

        for (const line of srcLines) {
            const trimmedLine = line.trim();

            if (!trimmedLine.length) continue;

            if (trimmedLine.startsWith('//')
                ||trimmedLine.startsWith('/*')
                ||trimmedLine.startsWith('*')
            ) {
                const strippedComment = trimmedLine
                                        .replace(/[*/\\#@!%^&()[\]{}<>_=+\-|;:,.'"~`]/g, '')
                                        .trim();

                if (strippedComment.length) commentLines++;
            }
            else linesOfCode++;
        }

        return new GeneralData(totalLines, linesOfCode, commentLines);
    }

    private async _processTypeData(tree: Tree): Promise<TypeData[]> {
        const types: TypeData[] = [];

        for (const { pattern, captures } of this._typeDeclQuery.matches(tree.rootNode)) {
            let kind: 'class' | 'interface';
            switch (pattern) {
                case 0: kind = 'class'; break;
                case 1: kind = 'interface'; break;
                default: continue;
            }

            const name = captures.find(c => c.name === 'type_name')!.node.text;

            const modifiers = new Set(
                captures
                .find(c => c.name === 'type_modifiers')?.node.text
                .trim()
                .split(' ')
                .filter(m => m && !m.startsWith('@'))
            );

            const superTypes = new Set<string>();
            const superclass = captures.find(c => c.name === 'superclass')?.node;
            if (superclass) superTypes.add(superclass.text);
            const interfaceList = captures.find(c => c.name === 'interface_list')?.node;
            interfaceList?.children.forEach(child => {
                if (child.type === 'type_identifier')
                    superTypes.add(child.text);
            });

            types.push(new TypeData(kind, name, modifiers, superTypes));
        }

        return types;
    }

    private async _processFunctionWeights(tree: Tree): Promise<FunctionWeightData[]> {
        const functionWeights: FunctionWeightData[] = [];

        for (const { captures } of this._methodQuery.matches(tree.rootNode)) {
            const name = captures.find(c => c.name === 'name')!.node.text;
            const bodyText = captures.find(c => c.name === 'method')!.node.text;

            const srcLines = bodyText.split('\n');
            let methodLOC = 0;

            for (const line of srcLines) {
                const trimmedLine = line.trim();
                if (trimmedLine.length
                    && !trimmedLine.startsWith('//')
                    && !trimmedLine.startsWith('/*')
                    && !trimmedLine.startsWith('*')) methodLOC++;
            }

            functionWeights.push(new FunctionWeightData(name, methodLOC));
        }

        return functionWeights;
    }
}
