
import * as sqlite3 from 'sqlite3';
import * as fs from 'fs';

import * as path from 'path';


export class SVNDiffProvider{
    private rootPath?: string;
    constructor(rootPath: string) {
        this.rootPath = rootPath;
    }

    async getSVNBaseFile(file: string): Promise<string | undefined> {
        if (!this.rootPath) {
            return;
        }

        let svnDb = new sqlite3.Database(`${this.rootPath}/.svn/wc.db`, sqlite3.OPEN_READONLY, (err: Error | null) => {
            console.log(err);
        });

        let filePath = file.replace(this.rootPath ? this.rootPath : '', '').substring(1);
        let sql = `select checksum from NODES where local_relpath = "${filePath}";`;

        let svnDbResult = await this.dbSelect(sql, svnDb);

        console.log(svnDbResult);
        let fileExname = path.extname(filePath);
        let svnOriginalTmpFile = `${this.rootPath}/.svn/tmp/tmp_diff.${fileExname}`;
        if (svnDbResult) {
            let filesha1 = svnDbResult.substring(6);
            let svnOriginalFile = `${this.rootPath}/.svn/pristine/${filesha1.substring(0, 2)}/${filesha1}.svn-base`;
            fs.copyFileSync(svnOriginalFile, svnOriginalTmpFile);
        }

        svnDb.close();
        return svnOriginalTmpFile;
    }

    async dbSelect(sql: string, db: sqlite3.Database): Promise<string> {
        let p = new Promise<string>((resolve, reject) => {
            db.get(sql, (err: Error | null, row: any) => {
                resolve(row.checksum);
            });
        });
        return await p;
    }

}