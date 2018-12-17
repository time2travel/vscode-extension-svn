


export enum SVNFileStatus {
    Unversioned = "unversioned",
    Modified = "modified",
    Added = "added",
    Deleted = "deleted",
    Ignored = "ignored",
}

export interface SVNFile {
    fileName: string;
    filePath: string;
    fileStatus: SVNFileStatus;
    isCommit: boolean;
}