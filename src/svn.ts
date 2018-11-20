

import * as cp from 'child_process';
import * as xml2js from 'xml2js';


function executeShellCommand(shellCmd: string, args: string[]|null, resultCallBack: (result: number, data: String) => void): void {

    const buffers: Buffer[] = [];
    let child = cp.spawn(shellCmd, args?args:[]);
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

function executeSVNCommand(args: string[]|null, resultCallBack: (result: number, data: String) => void): void{
    executeShellCommand('svn', args, resultCallBack);
}

export interface SVNStatusResult{
    rootPath: string;
    files:{filePath: string, status: string, willCommit: boolean}[];
}

export class SVN {
    private rootPath = './';
    constructor(rootPath: string){
        this.rootPath = rootPath;
    }

    public static async svnRootPath(path: string): Promise<string|undefined> {
        let p = new Promise<string|undefined>((resolve, reject) => {
            executeSVNCommand(['info', '--show-item', 'wc-root', path], (result: number, data: String) => {
                let resultInfo = data.search("W155007:");
                if(resultInfo >= 0){
                    resolve();
                }else{
                    resolve(data.toString().replace("\n", ""));
                }
            });
        });
        return await p;
    }

    public async svnDirCheck(): Promise<boolean> {
        let p = new Promise<boolean>((resolve, reject) => {
            executeSVNCommand(['status', this.rootPath], (result: number, data: String) => {
                let resultInfo = data.search("W155007:");
                if(resultInfo >= 0){
                    resolve(false);
                }else{
                    resolve(true);
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

    public status(resultCallBack: (result: SVNStatusResult) => void): void {
        executeSVNCommand(['status', '--xml', this.rootPath], (result: number, data: String) => {
            try {
                xml2js.parseString(data, (err: any, result: any) => {
                    let target = result.status.target[0];
                    let path = target["$"].path;
                    let entry = target.entry;
                    
                    let returnResult: SVNStatusResult = {
                        rootPath: path,
                        files: []
                    };

                    for(let obj of entry){
                        returnResult.files.push({
                            filePath: obj["$"].path,
                            status: obj["wc-status"][0]["$"].item,
                            willCommit: false
                        });
                    }

                    resultCallBack(returnResult);

                });
            } catch (error) {
                console.log(error);
            }
        });
    }

    public commit(commitFiles: string[], message: string, resultCallBack: (result: string) => void): void {
        let args = ['commit', '-m', message];
        for(let file of commitFiles){
            args.push(file);
        }
        executeSVNCommand(args, (result: number, data: String) => {
            resultCallBack(`result: ${data}`);
        });
    }

    public blame(editFile: string, selectLine: number, resultCallBack: (result: string, revision: string) => void): void {
        executeSVNCommand(['blame', '--xml', editFile], (result: number, data: String) => {
            try {
                xml2js.parseString(data, (err: any, result: any) => {
                    let blameEntry = result.blame.target[0].entry;
                    for(let blame of blameEntry){
                        let lineNumber = Number(blame["$"]["line-number"]);
                        if(lineNumber === selectLine){
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