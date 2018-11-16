'use strict';
import * as vscode from 'vscode';

import * as svn from './svn';
import { SVNQuickDiffProvider } from './svnQuickDiffProvider';
import { open } from 'inspector';

// import * as svnDiff from './svnQuickDiffProvider';

export function activate(context: vscode.ExtensionContext) {

    const outputChannel = vscode.window.createOutputChannel('SVN');
	outputChannel.show();
	context.subscriptions.push(outputChannel);

    const svnSCM = vscode.scm.createSourceControl("svn", "SVN");
    const commitResourceGroup = svnSCM.createResourceGroup("commit_file", "commit files");
    const changeResourceGroup = svnSCM.createResourceGroup("change_file", "change files");

    let rootPath = vscode.workspace.rootPath;
    if(rootPath === undefined){
        console.log('workspace root path is undefined.');
        return;
    }
    const diffProvider = new SVNQuickDiffProvider(rootPath);
    const globalSVN = new svn.SVN(rootPath);
    
    context.subscriptions.push(vscode.commands.registerCommand("svn.status", (...args: any[]) => {
        globalSVN.status((result: svn.SVNStatusResult) => {
            let commitFiles: vscode.SourceControlResourceState[] = [];
            let changeFiles: vscode.SourceControlResourceState[] = [];
            for(let file of result.files){
                if(file.status === 'modified'){
                    if(file.willCommit){
                        commitFiles.push({
                            resourceUri: vscode.Uri.file(file.filePath),
                            command: {
                                title: "change", 
                                command: "svn.openChange",
                                tooltip: "open file change.",
                                arguments: [file.filePath]
                            }
                        });
                    }else{
                        changeFiles.push({
                            resourceUri: vscode.Uri.file(file.filePath),
                            command: {
                                title: "change",
                                command: "svn.openChange",
                                tooltip: "open file change.",
                                arguments: [file.filePath]
                            }
                        });
                    }
                }
            }
            commitResourceGroup.resourceStates = commitFiles;
            changeResourceGroup.resourceStates = changeFiles;
        });
    }));

    context.subscriptions.push(vscode.commands.registerCommand("svn.commit", (...args: any[]) => {
        let commitFiles = commitResourceGroup.resourceStates;
        let commitFilesPath: string[] = [];
        for(let file of commitFiles){
            commitFilesPath.push(file.resourceUri.path);
        }
        let message = svnSCM.inputBox.value.toString();
        console.log(message);
        globalSVN.commit(commitFilesPath, message, (result: string) => {
            console.log(result);
            vscode.commands.executeCommand('svn.status');
        });
    }));

    context.subscriptions.push(vscode.commands.registerCommand("svn.update", (...args: any[]) => {
        globalSVN.update((result: string) => {
            console.log(result);
            vscode.commands.executeCommand('svn.status');
        });
    }));

    context.subscriptions.push(vscode.commands.registerCommand("svn.addCommit", (...args: any[]) => {
        let obj = args[0];
        console.log(obj);
        if(obj.resourceUri){
            let commitFiles: vscode.SourceControlResourceState[] = commitResourceGroup.resourceStates;
            let changeFiles: vscode.SourceControlResourceState[] = [];
            for(let file of changeResourceGroup.resourceStates){
                if(file.resourceUri.path === obj.resourceUri.path){
                    commitFiles.push(file);
                }else{
                    changeFiles.push(file);
                }
            }
            commitResourceGroup.resourceStates = commitFiles;
            changeResourceGroup.resourceStates = changeFiles;
        }else{
            let objs = obj._resourceStates;
            console.log(objs);
            // for(let st of objs){

            // }
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand("svn.removeCommit", (...args: any[]) => {
        let obj = args[0];
        console.log(obj);
        if(obj.resourceUri){
            let commitFiles: vscode.SourceControlResourceState[] = [];
            let changeFiles: vscode.SourceControlResourceState[] = changeResourceGroup.resourceStates;
            for(let file of commitResourceGroup.resourceStates){
                if(file.resourceUri.path === obj.resourceUri.path){
                    changeFiles.push(file);
                }else{
                    commitFiles.push(file);
                }
            }
            commitResourceGroup.resourceStates = commitFiles;
            changeResourceGroup.resourceStates = changeFiles;
        }else{
            let objs = obj._resourceStates;
            console.log(objs);
            // for(let st of objs){
                
            // }
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand("svn.openChange", async (...args: any[]) => {
        let openFile: string = args[0];
        let openFileName = openFile.split("/")[openFile.split("/").length-1];   //不熟悉js基础库，就先这样吧。
        let originalFile = await diffProvider.getSVNBaseFile(openFile);
        console.log(openFile, originalFile);
        vscode.commands.executeCommand('vscode.diff', vscode.Uri.file(originalFile ? originalFile:''), vscode.Uri.file(openFile), `${openFileName}(base<-->workcopy)`);
    }));

    context.subscriptions.push(vscode.commands.registerCommand("svn.showBlame", (...args: any[]) => {
        let editor = vscode.window.activeTextEditor;
        if(!editor){
            return;
        }

        let selectLineNumber =  editor.selection.anchor.line + 1;
        let editFile = editor.document.fileName;

        globalSVN.blame(editFile, selectLineNumber, (result: string, revision: string) => {
            vscode.window.setStatusBarMessage(result);
            const blameMsg = result;
            globalSVN.log(editFile, revision, (result: string) => {
                vscode.window.setStatusBarMessage(blameMsg + " >>commit message:" + result);
            });
        });
        
    }));
    
    vscode.commands.executeCommand('svn.status');
}

// this method is called when your extension is deactivated
export function deactivate() {
}