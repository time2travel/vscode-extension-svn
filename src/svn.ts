

import * as cp from 'child_process';
import * as xml2js from 'xml2js';
import * as path from 'path';
import { SVNFile, SVNFileStatus } from './svnFile';


function executeShellCommand(shellCmd: string, args: string[] | null, resultCallBack: (result: number, data: String) => void): void {

    const buffers: Buffer[] = [];
    let child = cp.spawn(shellCmd, args ? args : []);
    child.stdout.on('data', (data: Buffer) => {
        buffers.push(data);
    });
    child.stderr.on('data', (err: Buffer) => {
        buffers.push(err);
    });
    child.stdout.on('close', (msg: any) => {
        let strData = Buffer.concat(buffers).toString('utf8');
        resultCallBack(msg, strData);
    });
}

function executeSVNCommand(args: string[] | null, resultCallBack: (result: number, data: String) => void): void {
    executeShellCommand('svn', args, resultCallBack);
}

export class SVN {
    private rootPath = './';

    private svnFiles: SVNFile[] = [];

    constructor(rootPath: string) {
        this.rootPath = rootPath;
    }

    public static async svnRootPath(path: string): Promise<string | undefined> {
        let p = new Promise<string | undefined>((resolve, reject) => {
            executeSVNCommand(['info', '--show-item', 'wc-root', path], (result: number, data: String) => {
                let resultInfo = data.startsWith("svn:");
                if (resultInfo) {
                    resolve();
                } else {
                    resolve(data.toString().replace("\n", ""));
                }
            });
        });
        return await p;
    }

    public update(resultCallBack: (result: string) => void): void {
        executeSVNCommand(['update', this.rootPath], (result: number, data: String) => {
            resultCallBack(`${data}`);
        });
    }

    public status(resultCallBack: (result: SVNFile[]) => void): void {
        executeSVNCommand(['status', '--xml', this.rootPath], (result: number, data: String) => {
            try {
                xml2js.parseString(data, (err: any, result: any) => {
                    let target = result.status.target[0];
                    let entry = target.entry;

                    this.svnFiles = [];
                    for (let file of entry) {
                        this.svnFiles.push({
                            fileName: path.basename(file["$"].path),
                            filePath: file["$"].path,
                            fileStatus: file["wc-status"][0]["$"].item,
                            isCommit: false
                        });
                    }
                });
            } catch (error) {
                console.log(error);
            } finally{
                resultCallBack(this.svnFiles);
            }
        });
    }

    public revert(commitFiles: SVNFile[], resultCallBack: (result: string) => void): void {
        let args = ['revert'];
        for(let file of commitFiles) {
            args.push(file.filePath);
        }
        executeSVNCommand(args, (result: number, data: String) => {
            resultCallBack(`${data}`);
        });
    }

    public async commit(commitFiles: SVNFile[], message: string, resultCallBack: (result: string) => void): Promise<void> {
        let unversionedFiles: SVNFile[] = [];
        for(let file of commitFiles){
            if(file.fileStatus === SVNFileStatus.Unversioned){
                unversionedFiles.push(file);
            }
        }
        let filesAddResult: String;
        if(unversionedFiles.length > 0){
            await this.add(unversionedFiles, (result: number, data: String) => {
                filesAddResult = `${data}`;
            });
        }

        let args = ['commit', '-m', message];
        for (let file of commitFiles) {
            args.push(file.filePath);
        }
        executeSVNCommand(args, (result: number, data: String) => {
            resultCallBack(`result: \n ${filesAddResult} \n ${data}`);
        });
    }

    public add(addFiles: SVNFile[], resultCallBack: (result: number, data: String) => void): void {
        if(addFiles.length <= 0){
            console.log("add file is empty.");
            return;
        }
        let args = ['add'];
        for(let file of addFiles){
            if(file.fileStatus === SVNFileStatus.Unversioned){
                args.push(file.filePath);
            }else{
                console.log(`file: ${file.fileName} already added.`);
            }
        }
        executeSVNCommand(args, (result: number, data: String) => {
            resultCallBack(result, data);
        });
    }

    public blame(editFile: string, selectLine: number, resultCallBack: (result: string, revision: string) => void): void {
        executeSVNCommand(['blame', '--xml', editFile], (result: number, data: String) => {
            try {
                xml2js.parseString(data, (err: any, result: any) => {
                    let blameEntry = result.blame.target[0].entry;
                    for (let blame of blameEntry) {
                        let lineNumber = Number(blame["$"]["line-number"]);
                        if (lineNumber === selectLine) {
                            let commit = blame.commit[0];
                            let revision = commit["$"]["revision"];
                            let author = commit.author[0];
                            let date = commit.date[0];

                            let commitInfo = `line ${lineNumber} commit by ${author} on ${date}, revision:${revision}`;

                            resultCallBack(commitInfo, revision);
                            return;
                        }
                    }
                });
            } catch (error) {
                console.log(error);
            }
        });
    }

    public log(editFile: string, revision: string, resultCallBack: (result: string) => void): void {
        executeSVNCommand(['log', '--xml', `-r${revision}`, editFile], (result: number, data: String) => {
            try {
                xml2js.parseString(data, (err: any, result: any) => {
                    let msg = result.log.logentry[0].msg[0];
                    resultCallBack(msg);
                });
            } catch (error) {
                console.log(error);
            }
        });
    }

}