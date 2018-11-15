
import * as vscode from 'vscode';

export class SVNQuickDiffProvider implements vscode.QuickDiffProvider {

    provideOriginalResource(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Uri>{
        console.log(uri);
        let path = `${uri.path}.svn`;
        let originalResource = uri.with(
            {
                scheme: 'svn',
		        path,
            }
        );
        console.log(originalResource);
        return originalResource;
    }

}