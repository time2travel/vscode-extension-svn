'use strict';
import * as vscode from 'vscode';

import * as svn from './svn';
import { SVNSCM } from './svnScm';


export async function activate(context: vscode.ExtensionContext) {

    let rootPath = vscode.workspace.rootPath;
    if (rootPath === undefined) {
        console.log('workspace root path is undefined.');
        return;
    }

    let svnRootPath = await svn.SVN.svnRootPath(rootPath);
    if(svnRootPath === undefined || svnRootPath.length <= 0){
        console.log("this path not a svn dir.");
        return;
    }
    //init svn scm.
    const svnSCM: SVNSCM = new SVNSCM(context, svnRootPath);
    console.log(svnSCM);

    vscode.commands.executeCommand('svn.status');
}

// this method is called when your extension is deactivated
export function deactivate() {
}