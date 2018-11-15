'use strict';
import * as vscode from 'vscode';

import * as svn from './svn';

// import * as svnDiff from './svnQuickDiffProvider';

export function activate(context: vscode.ExtensionContext) {

    const outputChannel = vscode.window.createOutputChannel('SVN');
	outputChannel.show();
	context.subscriptions.push(outputChannel);

    const svnSCM = vscode.scm.createSourceControl("svn", "SVN");
    const commitResourceGroup = svnSCM.createResourceGroup("commit_file", "commit files");
    const changeResourceGroup = svnSCM.createResourceGroup("change_file", "change files");

    // svnSCM.quickDiffProvider = new svnDiff.SVNQuickDiffProvider();

    let rootPath = vscode.workspace.rootPath;
    if(rootPath === undefined){
        console.log('workspace root path is undefined.');
        return;
    }
    const curSvn = new svn.SVN(rootPath);
    curSvn.status((result: svn.SVNStatusResult) => {
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

    context.subscriptions.push(vscode.commands.registerCommand("svn.commit", (...args: any[]) => {
        let commitFiles = commitResourceGroup.resourceStates;
        let commitFilesPath: string[] = [];
        for(let file of commitFiles){
            commitFilesPath.push(file.resourceUri.path);
        }
        let message = svnSCM.inputBox.value.toString();
        curSvn.commit(commitFilesPath, message, (result: string) => {
            console.log(result);
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
            for(let st of objs){

            }
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
            for(let st of objs){

            }
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand("svn.openChange", (...args: any[]) => {
        console.log(args);
        vscode.commands.executeCommand('vscode.open', args[0]).then();
        // vscode.commands.executeCommand('vscode.diff', args[0], args[0]);
    }));
    
}

// this method is called when your extension is deactivated
export function deactivate() {
}