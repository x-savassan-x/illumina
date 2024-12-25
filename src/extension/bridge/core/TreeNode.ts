type BaseNode = {
    name: string;
    parent: FolderNode | null;
}


type FolderNode = BaseNode & {
    type: 'folder';
    children: Map<string, TreeNode>;
}


type FileNode = BaseNode & {
    type: 'file';
    dependencies: Set<FileNode>;
    dependents: Set<FileNode>;
    cacheKey: string;
}


type TreeNode = FolderNode | FileNode