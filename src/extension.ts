'use strict';
import * as vscode from 'vscode';

import * as svn from './svn';

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
    const curSvn = new svn.SVN(rootPath);
    curSvn.status((result: svn.SVNStatusResult) => {
        let commitFiles: vscode.SourceControlResourceState[] = [];
        let changeFiles: vscode.SourceControlResourceState[] = [];
        for(let file of result.files){
            if(file.status === 'modified'){
                if(file.willCommit){
                    commitFiles.push({
                        resourceUri: vscode.Uri.file(file.filePath)
                    });
                }else{
                    changeFiles.push({
                        resourceUri: vscode.Uri.file(file.filePath)
                    });
                }
            }
        }
        commitResourceGroup.resourceStates = commitFiles;
        changeResourceGroup.resourceStates = changeFiles;
    });

    context.subscriptions.push(vscode.commands.registerCommand("svn.addCommit", (...args: any[]) => {
        let obj = args[0];
        console.log(obj);
        if(obj.resourceUri){

        }else{
            let objs = obj._resourceStates;
            for(let st of objs){

            }
        }
    }));
    
}

// this method is called when your extension is deactivated
export function deactivate() {
}