import { LRUCache } from "lru-cache";
import { Edit } from "tree-sitter";
import { sep } from "path";
import { Change } from "./Change";


export class TreeManager {

    public handleChange(change: Change): void {
        switch (change.operation) {
            case 'delete':
                this._delete(change.path);
                break;
            case 'modify':
                this._modify(change.path, change.content, change.edits);
                break;
            case 'rename':
                this._rename(change.parentPath, change.oldName, change.newName);
                break;
            case 'move':
                this._move(change.from, change.to);
                break;
        }
    }

    public dispose(): void {}

    private _delete(path: string): void {
        const pathSegments = path.split(sep);
    }

    private _modify(path: string, content: string, edits: Edit[]): void {
        const pathSegments = path.split(sep);
    }

    private _rename(parentPath: string, oldName: string, newName: string): void {
        const pathSegments = parentPath.split(sep);
    }

    private _move(from: string, to: string): void {}
}