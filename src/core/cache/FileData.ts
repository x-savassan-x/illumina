export interface FileData {
    toString(): string
}


export class GeneralData implements FileData {
    public constructor(
        public totalLOC: number,
        public commentLOC: number
    ) { }

    public toString(): string {
        return `- totalLOC: ${this.totalLOC}\n- commentLOC: ${this.commentLOC}`;
    }
}


export class ImportData implements FileData {
    public constructor(
        public imports: Set<string>
    ) { }

    public toString(): string {
        return `- imports:\n  - ${Array.from(this.imports).join('\n  - ')}`;
    }
}


export class TypeData implements FileData {
    public constructor(
        public kind: 'class' | 'interface',
        public name: string,
        public modifiers: Set<string> = new Set(),
        public superTypes: Set<string> = new Set(),
        public fields: Map<string, VariableData> = new Map(),
        public methods: Map<string, FunctionData> = new Map()
    ) { }

    public toString(): string {
        return `- ${this.kind} ${this.name}:\n` +
            `  - modifiers: ${Array.from(this.modifiers).join(', ')}\n` +
            `  - superTypes: ${Array.from(this.superTypes).join(', ')}\n` +
            `  - fields:\n    ${Array.from(this.fields.values()).join('\n    ')}\n` +
            `  - methods:\n    ${Array.from(this.methods.values()).join('\n    ')}\n`;
    }
}


export class VariableData implements FileData {
    public constructor(
        public name: string,
        public type: string,
        public modifiers: Set<string> = new Set()
    ) { }

    public toString(): string {
        const modifiers = Array.from(this.modifiers).join(', ');
        return `- (${modifiers}) ${this.type} ${this.name}`;
    }
}


export class FunctionData implements FileData {
    public constructor(
        public name: string,
        public returnType: string,
        public modifiers: Set<string> = new Set(),
        public parameters: Map<string, string> = new Map()
    ) { }

    public toString(): string {
        const modifiers = Array.from(this.modifiers).join(', ');
        const params = Array.from(this.parameters.entries()).map(([name, type]) => `${type} ${name}`).join(', ');
        return `- (${modifiers}) ${this.returnType} ${this.name}(${params})`;
    }
}
