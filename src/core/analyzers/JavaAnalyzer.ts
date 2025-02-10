import { Tree, Query, SyntaxNode } from 'tree-sitter';
import Java from 'tree-sitter-java';
import { Analyzer } from "./Analyzer";
import {
    FileData,
    GeneralData,
    ImportData,
    TypeData,
    FunctionData,
    VariableData
} from "@core/index";


export class JavaAnalyzer extends Analyzer {
    private readonly _generalQuery: Query;
    private readonly _importQuery: Query;
    private readonly _typeDeclQuery: Query;
    private readonly _typeBodyQuery: Query;

    public constructor() {
        super(Java);
        this._generalQuery = new Query(Java, `
            (line_comment) @comment
            (block_comment) @comment
        `);
        this._importQuery = new Query(Java, `
            (import_declaration
                (scoped_identifier) @import
            )
        `);
        this._typeDeclQuery = new Query(Java, `
            (program
                (class_declaration
                    (modifiers)? @type_modifiers
                    (identifier) @type_name
                    (superclass (type_identifier) @superclass)?
                    (super_interfaces (type_list) @interface_list)?
                ) @class
            )
            
            (program
                (interface_declaration
                    (modifiers)? @type_modifiers
                    (identifier) @type_name
                    (extends_interfaces (type_list) @interface_list)?
                ) @interface
            )
        `);
        this._typeBodyQuery = new Query(Java, `
            (field_declaration
                (modifiers)? @field_modifiers
                type: (_) @field_type
                (variable_declarator name:
                    (identifier) @field_name
                )
            ) @field

            (method_declaration
                (modifiers)? @method_modifiers
                type: (_) @return_type
                name: (identifier) @method_name
                (formal_parameters) @param_list
            ) @method
        `);
    }

    public override async processTree(tree: Tree, data: FileData[]): Promise<boolean> {
        if (this._hasError(tree)) return false;

        const [generalData, importData, typeData] = await Promise.all([
            this._processGeneralData(tree, data),
            this._processImportData(tree, data),
            this._processTypeData(tree, data)
        ]);

        data.length = 0;
        data.push(generalData, importData, typeData);

        return true;
    }

    private async _processGeneralData(tree: Tree, _: FileData[]): Promise<FileData> {
        const totalLOC = tree.rootNode.endPosition.row + 1;
        let commentLOC = 0;

        for(const {node} of this._generalQuery.captures(tree.rootNode))
            commentLOC += node.endPosition.row - node.startPosition.row + 1;

        return new GeneralData(totalLOC, commentLOC);
    }

    private async _processImportData(tree: Tree, _: FileData[]): Promise<FileData> {
        const imports = [];
        for(const {node} of this._importQuery.captures(tree.rootNode))
            imports.push(node.text);
        return new ImportData(imports);
    }

    private async _processTypeData(tree: Tree, _: FileData[]): Promise<FileData[]> {
        const types: TypeData[] = [];

        for (const { pattern, captures } of this._typeDeclQuery.matches(tree.rootNode)) {
            let kind: 'class' | 'interface';
            switch (pattern) {
                case 0: kind = 'class'; break;
                case 1: kind = 'interface'; break;
                default: continue;
            }

            const name = captures.find(c => c.name === 'type_name')!.node.text;

            const modifiers = captures
                .find(c => c.name === 'type_modifiers')?.node.text
                .split(' ')
                .filter(m => m && !m.startsWith('@'));

            const superTypes = [];
            const superclass = captures.find(c => c.name === 'superclass')?.node;
            if (superclass) superTypes.push(superclass.text);
            const interfaceList = captures.find(c => c.name === 'interface_list')?.node;
            if (interfaceList) {
                for (const child of interfaceList.children) {
                    if (child.type === 'type_identifier') {
                        superTypes.push(child.text);
                    }
                }
            }

            const bodyNode = captures.find(c => c.name === kind)!.node;

            types.push(new TypeData(
                kind,
                name,
                modifiers,
                superTypes,
                ...this._processTypeDetail(bodyNode)
            ));
        }

        return types;
    }

    private _processTypeDetail(body: SyntaxNode): [
        Map<string, VariableData>,
        Map<string, FunctionData>
    ] {
        const fields = new Map<string, VariableData>();
        const methods = new Map<string, FunctionData>();

        for (const { pattern, captures } of this._typeBodyQuery.matches(body)) {
            switch (pattern) {
                case 0: {
                    const name = captures.find(c => c.name === 'field_name')!.node.text;
                    const type = captures.find(c => c.name === 'field_type')!.node.text;
                    const modifiers = captures
                        .find(c => c.name === 'field_modifiers')?.node.text
                        .split(' ')
                        .filter(m => m && !m.startsWith('@'));
                    fields.set(name, new VariableData(name, type, modifiers));
                    break;
                }
                case 1: {
                    const name = captures.find(c => c.name === 'method_name')!.node.text;
                    const returnType = captures.find(c => c.name === 'return_type')!.node.text;
                    const modifiers = captures
                        .find(c => c.name === 'method_modifiers')?.node.text
                        .split(' ')
                        .filter(m => m && !m.startsWith('@'));
                    const parameters = new Map<string, string>();
                    const paramList = captures.find(c => c.name === 'param_list')!.node;
                    for (const param of paramList.children) {
                        if (param.type === 'formal_parameter') {
                            const paramType = param.childForFieldName('type')!.text;
                            const paramName = param.childForFieldName('name')!.text;
                            parameters.set(paramName, paramType);
                        }
                    }
                    methods.set(name, new FunctionData(name, returnType, parameters, modifiers));
                    break;
                }
                default: continue;
            }
        }

        return [fields, methods];
    }
}
