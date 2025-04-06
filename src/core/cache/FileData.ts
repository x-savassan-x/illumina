export interface FileData {}


export class GeneralData implements FileData {
    public constructor(
        public lines: number,
        public linesOfCode: number,
        public commentLines: number
    ) { }
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
}


export class VariableData implements FileData {
    public constructor(
        public name: string,
        public type: string,
        public modifiers: Set<string> = new Set()
    ) { }
}


export class FunctionData implements FileData {
    public constructor(
        public name: string,
        public returnType: string,
        public modifiers: Set<string> = new Set(),
        public parameters: Map<string, string> = new Map()
    ) { }
}


export class FunctionWeightData implements FileData {
    public constructor(
        public name: string,
        public weight: number
    ) { }
}
