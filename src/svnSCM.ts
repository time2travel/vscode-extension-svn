

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
        this.extensionContext.subscriptions.push(vscode.commands.registerCommand("svn.status", this.status()));
        this.extensionContext.subscriptions.push(vscode.commands.registerCommand("svn.commit", this.commit()));
        this.extensionContext.subscriptions.push(vscode.commands.registerCommand("svn.update", this.update()));
        this.extensionContext.subscriptions.push(vscode.commands.registerCommand("svn.addCommit", this.addCommit()));
        this.extensionContext.subscriptions.push(vscode.commands.registerCommand("svn.revert", this.revert()));
        this.extensionContext.subscriptions.push(vscode.commands.registerCommand("svn.removeCommit", this.removeCommit()));
        this.extensionContext.subscriptions.push(vscode.commands.registerCommand("svn.openChange", this.openChange()));
        this.extensionContext.subscriptions.push(vscode.commands.registerCommand("svn.showBlame", this.showBlame()));
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

    private status(){
        let that = this;
        return (...args: any[]) => {
            that.globalSVN.status((result: SVNFile[]) => {
                that.changeFiles = result;
                that.updateSCRStates(that.changeFiles);
            });
        };
    }

    private commit(){
        let that = this;
        return (...args: any[]) => {
            let commitFiles: SVNFile[] = [];
            for(let file of that.changeFiles){
                if(file.isCommit){
                    commitFiles.push(file);
                }
            }

            let message = that.svnSCM.inputBox.value;
            console.log(message);
            if (message.length <= 0) {
                vscode.window.showErrorMessage("no commit message ! ! !");
                return;
            }

            that.globalSVN.commit(commitFiles, message, (result: string) => {
                console.log(result);
                that.outputChannel.append(result);
                let resultLines = result.replace("\n", "").trimRight();
                vscode.window.showWarningMessage(resultLines);
                vscode.commands.executeCommand('svn.status');
            });
        };
    }

    private update(){
        let that = this;
        return (...args: any[]) => {
            that.globalSVN.update((result: string) => {
                console.log(result);
                that.outputChannel.append(result);
                let resultLines = result.replace("\n", "").trimRight();
                vscode.window.showWarningMessage(resultLines);
                vscode.commands.executeCommand('svn.status');
            });
        };
    }

    private addCommit(){
        let that = this;
        return (...args: any[]) => {
            let obj = args[0];
            console.log(obj);

            for(let file of that.changeFiles){
                if(file.filePath === obj.resourceUri.path){
                    file.isCommit = true;
                }
            }

            that.updateSCRStates(that.changeFiles);
        };
    }

    private revert(){
        let that = this;
        return (...args: any[]) => {
            let openFilePath: string = args[0].resourceUri.path;
            console.log(openFilePath);
            let file: SVNFile|null = null;
            for(let f of that.changeFiles){
                if(f.filePath === openFilePath){
                    file = f;
                }
            }
            if(file === null){
                return;
            }
            that.globalSVN.revert([file], (result: string) => {
                console.log(result);
                that.outputChannel.append(result);
                let resultLines = result.replace("\n", "").trimRight();
                vscode.window.showWarningMessage(resultLines);
                vscode.commands.executeCommand('svn.status');
            });
        };
    }

    private removeCommit(){
        let that = this;
        return (...args: any[]) => {
            let obj = args[0];
            console.log(obj);

            for(let file of that.changeFiles){
                if(file.filePath === obj.resourceUri.path){
                    file.isCommit = false;
                }
            }

            that.updateSCRStates(that.changeFiles);
        };
    }

    private openChange(){
        let that = this;
        return async (...args: any[]) => {
            let openFile: string = args[0];
            let openFileName = path.basename(openFile);
            let originalFile = await that.diffProvider.getSVNBaseFile(openFile);
            console.log(openFile, originalFile);
            vscode.commands.executeCommand('vscode.diff', 
                                        vscode.Uri.file(originalFile ? originalFile : ''), 
                                        vscode.Uri.file(openFile), 
                                        `${openFileName}(base<-->workcopy)`);
        };
    }

    private showBlame(){
        let that = this;
        return (...args: any[]) => {
            let editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }
    
            let selectLineNumber = editor.selection.anchor.line + 1;
            let editFile = editor.document.fileName;
    
            that.globalSVN.blame(editFile, selectLineNumber, (result: string, revision: string) => {
                vscode.window.setStatusBarMessage(result);
                const blameMsg = result;
                that.globalSVN.log(editFile, revision, (result: string) => {
                    that.outputChannel.append(`\n**********\n${blameMsg} \n>> commit message:\n${result}\n**********\n`);
                    result = result.replace("\n", "");
                    vscode.window.setStatusBarMessage(blameMsg + " >>commit message:" + result);
                });
            });
        };
    }
}