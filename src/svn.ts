

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

}