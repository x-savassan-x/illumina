import { Edit } from "tree-sitter";


export enum Operation { Delete, Modify, Rename, Move }


type Deletion = {
    operation: Operation.Delete;
    path: string;
}


type Modification = {
    operation: Operation.Modify;
    path: string;
    content: string;
    edits: Edit[];
}


type Renaming = {
    operation: Operation.Rename;
    path: string;
    newName: string;
}


type Moving = {
    operation: Operation.Move;
    path: string;
    newDir: string;
}


export type Change = Deletion | Modification | Moving | Renaming;
