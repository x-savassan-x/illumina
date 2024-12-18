import { Edit } from "tree-sitter";


type Deletion = {
    operation: 'delete';
    path: string;
    isFile: boolean;
}


type Modification = {
    operation: 'modify';
    path: string;
    content: string;
    edits: Edit[];
}


type Renaming = {
    operation: 'rename';
    parentPath: string;
    oldName: string;
    newName: string;
}


type Moving = {
    operation: 'move';
    from: string;
    to: string;
}


export type Change = Deletion | Modification | Moving | Renaming;
