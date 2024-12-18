import { workspace } from "vscode";


export function getConfig<T>(key: string): T {
    return workspace.getConfiguration('illumina').get<T>(key)!;
}