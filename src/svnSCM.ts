

import * as path from 'path';

import * as vscode from 'vscode';

import { SVN } from './svn';
import { SVNFile, SVNFileStatus } from './svnFile';
import { SVNDiffProvider } from './svnDiffProvider';


// 获取资源路径
const iconsRootPath = path.join(path.dirname(__dirname), 'resources', 'icons');
function getIconUri(iconName: string, theme: string): vscode.Uri {
	return vscode.Uri.file(path.join(iconsRootPath, theme, `${iconName}.svg`));
}

export class SVNSCM {
    private rootPath: string;

    private globalSVN: SVN;
    private svnSCM: vscode.SourceControl;
    private extensionContext: vscode.ExtensionContext;

    private commitResourceGroup: vscode.SourceControlResourceGroup;
    private changeResourceGroup: vscode.SourceControlResourceGroup;

    private outputChannel: vscode.OutputChannel;

    private diffProvider: SVNDiffProvider;

    private changeFiles: SVNFile[];

    constructor(context: vscode.ExtensionContext, rootPath: string){
        this.extensionContext = context;
        this.rootPath = rootPath;

        //init svn.
        this.globalSVN = new SVN(this.rootPath ? this.rootPath : '');

        //init SCM.
        this.svnSCM = vscode.scm.createSourceControl("svn", "SVN");
        this.svnSCM.inputBox.placeholder = "input commit message here.";
        //create resource group.
        this.commitResourceGroup = this.svnSCM.createResourceGroup("commit_file", "commit files");
        this.changeResourceGroup = this.svnSCM.createResourceGroup("change_file", "change files");
        //create ouput channel.
        this.outputChannel = vscode.window.createOutputChannel('SVN');
        this.outputChannel.show();

        this.diffProvider = new SVNDiffProvider(this.rootPath);

        this.changeFiles = [];

        this.registerAllCommand();
    }

    private registerAllCommand() {
        vscode.commands.registerCommand("svn.status", this.status);
        vscode.commands.registerCommand("svn.commit", this.commit);
        vscode.commands.registerCommand("svn.update", this.update);
        vscode.commands.registerCommand("svn.addCommit", this.addCommit);
        vscode.commands.registerCommand("svn.revert", this.revert);
        vscode.commands.registerCommand("svn.removeCommit", this.removeCommit);
        vscode.commands.registerCommand("svn.openChange", this.openChange);
        vscode.commands.registerCommand("svn.showBlame", this.showBlame);
    }

    private icoName(file: SVNFile): string{
        let icoName = "";
        switch(file.fileStatus){
            case SVNFileStatus.Unversioned:
                icoName = "status-untracked";
                break;
            case SVNFileStatus.Modified:
                icoName = "status-modified";
                break;
            case SVNFileStatus.Added:
                icoName = "status-added";
                break;
            case SVNFileStatus.Deleted:
                icoName = "status-deleted";
                break;
            default:
                icoName = "status-ignored";
        }
        return icoName;
    }

    private createSCRStates(files: SVNFile[]): vscode.SourceControlResourceState[] {
        let changeFiles: vscode.SourceControlResourceState[] = [];
        for (let file of files) {

            if (file.filePath === null){
                continue;
            }

            changeFiles.push({
                resourceUri: vscode.Uri.file(file.filePath),
                command: {
                    title: "change",
                    command: "svn.openChange",
                    tooltip: "open file change.",
                    arguments: [file.filePath]
                },
                decorations: {
                    tooltip: "src",
                    light: {iconPath: getIconUri(this.icoName(file), "light")},
                    dark: {iconPath: getIconUri(this.icoName(file), "dark")}
                }
            });
        }
        return changeFiles;
    }

    private updateSCRStates(files: SVNFile[]){
        let commitFiles: SVNFile[] = [];
        let changeFiles: SVNFile[] = [];
        for(let file of files){
            if(file.isCommit){
                commitFiles.push(file);
            }else{
                changeFiles.push(file);
            }
        }
        this.commitResourceGroup.resourceStates = this.createSCRStates(commitFiles);
        this.changeResourceGroup.resourceStates = this.createSCRStates(changeFiles);
    }

    private status(...args: any[]){
        this.globalSVN.status((result: SVNFile[]) => {
            this.changeFiles = result;
            this.updateSCRStates(this.changeFiles);
        });
    }

    private commit(...args: any[]){
        let commitFiles: SVNFile[] = [];
        for(let file of this.changeFiles){
            if(file.isCommit){
                commitFiles.push(file);
            }
        }

        let message = this.svnSCM.inputBox.value;
        console.log(message);
        if (message.length <= 0) {
            vscode.window.showErrorMessage("no commit message ! ! !");
            return;
        }

        this.globalSVN.commit(commitFiles, message, (result: string) => {
            console.log(result);
            this.outputChannel.append(result);
            let resultLines = result.replace("\n", "").trimRight();
            vscode.window.showWarningMessage(resultLines);
            vscode.commands.executeCommand('svn.status');
        });
    }

    private update(...args: any[]){
        this.globalSVN.update((result: string) => {
            console.log(result);
            this.outputChannel.append(result);
            let resultLines = result.replace("\n", "").trimRight();
            vscode.window.showWarningMessage(resultLines);
            vscode.commands.executeCommand('svn.status');
        });
    }

    private addCommit(...args: any[]){
        let obj = args[0];
        console.log(obj);
        for(let file of this.changeFiles){
            if(file.filePath === obj){
                file.isCommit = true;
            }
        }
        this.updateSCRStates(this.changeFiles);
    }

    private revert(...args: any[]){
        let openFilePath: string = args[0];
        console.log(openFilePath);
        let file: SVNFile|null = null;
        for(let f of this.changeFiles){
            if(f.filePath === openFilePath){
                file = f;
            }
        }
        if(file === null){
            return;
        }
        this.globalSVN.revert([file], (result: string) => {
            console.log(result);
            this.outputChannel.append(result);
            let resultLines = result.replace("\n", "").trimRight();
            vscode.window.showWarningMessage(resultLines);
            vscode.commands.executeCommand('svn.status');
        });
    }

    private removeCommit(...args: any[]){
        let obj = args[0];
        console.log(obj);
        for(let file of this.changeFiles){
            if(file.filePath === obj){
                file.isCommit = false;
            }
        }
        this.updateSCRStates(this.changeFiles);
    }

    private async openChange(...args: any[]){
        let openFile: string = args[0];
        let openFileName = path.basename(openFile);
        let originalFile = await this.diffProvider.getSVNBaseFile(openFile);
        console.log(openFile, originalFile);
        vscode.commands.executeCommand('vscode.diff', 
                                       vscode.Uri.file(originalFile ? originalFile : ''), 
                                       vscode.Uri.file(openFile), 
                                       `${openFileName}(base<-->workcopy)`);
    }

    private showBlame(...args: any[]){
        let editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        let selectLineNumber = editor.selection.anchor.line + 1;
        let editFile = editor.document.fileName;

        this.globalSVN.blame(editFile, selectLineNumber, (result: string, revision: string) => {
            vscode.window.setStatusBarMessage(result);
            const blameMsg = result;
            this.globalSVN.log(editFile, revision, (result: string) => {
                this.outputChannel.append(`${blameMsg} \n>> commit message:\n${result}`);
                result = result.replace("\n", "\t");
                vscode.window.setStatusBarMessage(blameMsg + " >>commit message:" + result);
            });
        });
    }
}