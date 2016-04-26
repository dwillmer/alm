import * as sw from "../../utils/simpleWorker";
import * as contract from "./fileListingContract";
import * as fsu from "../../utils/fsu";

import * as glob from "glob";
import chokidar = require('chokidar');
import {throttle} from "../../../common/utils";
import path = require('path');
import * as types from "../../../common/types";

/** A Map for faster live calculations */
type LiveList = { [filePath: string]: types.FilePathType };
/** The directory to watch */
let directoryUnderWatch: string;

namespace Worker {
    export const echo: typeof contract.worker.echo = (q) => {
        return master.increment(q).then((res) => {
            return {
                text: q.text,
                num: res.num
            };
        });
    }

    export const setupWatch: typeof contract.worker.setupWatch = (q) => {
        directoryUnderWatch = q.directory;

        let completed = false;
        let liveList: LiveList = {};

        // Effectively a list of the mutations that `liveList` is going through after initial sync
        let bufferedAdded: types.FilePath[] = [];
        let bufferedRemoved: types.FilePath[] = [];

        // Utility to send new file list
        const sendNewFileList = () => {
            let filePaths = Object.keys(liveList)
                .filter(x =>
                    // Remove .git we have no use for that here
                    !x.includes('/.git/')
                    // MAC
                    && x !== '.DS_Store'
                )
                // sort
                .sort((a, b) => {
                    // sub dir wins!
                    if (b.startsWith(a)) {
                        return -1;
                    }
                    if (a.startsWith(b)) {
                        return 1;
                    }

                    // The next sorts are slow and only done after initial listing!
                    if (!completed) {
                        return a.length - b.length;
                    }

                    // sort by name
                    return a.toLowerCase().localeCompare(b.toLowerCase());
                })

                // Convert ot file path type
                .map(filePath => {
                    let type = liveList[filePath];
                    return { filePath, type };
                });

            master.fileListUpdated({
                filePaths,
                completed
            });

            // Send out the delta as well
            // Unless of course this is the *initial* sending of file listing
            if (bufferedAdded.length || bufferedRemoved.length) {
                master.fileListingDelta({
                    addedFilePaths: bufferedAdded,
                    removedFilePaths: bufferedRemoved
                });
                bufferedAdded = [];
                bufferedRemoved = [];
            }
        };

        /**
         * Slower version for
         * - initial partial serach
         * - later updates which might be called a lot because of some directory of files removed
         */
        let sendNewFileListThrottled = throttle(sendNewFileList, 1500);

        /**
         * Utility function to get the listing from a directory
         * No side effects in this function
         */
        const getListing = (dirPath: string): Promise<types.FilePath[]> => {
            return new Promise((resolve) => {
                let mg = new glob.Glob('**', { cwd: dirPath, dot: true }, (e, globResult) => {
                    if (e) {
                        console.error('Globbing error:', e);
                    }

                    let list = globResult.map(nl => {
                        let p = path.resolve(dirPath, nl);
                        let type = mg.cache[p] && mg.cache[p] == 'FILE' ? types.FilePathType.File : types.FilePathType.Dir;
                        return {
                            filePath: fsu.consistentPath(p),
                            type,
                        }
                    });

                    resolve(list);
                });
            });
        }

        // create initial list using 10x faster glob.Glob!
        (function() {
            const cwd = q.directory;
            const mg = new glob.Glob('**', { cwd, dot: true }, (e, newList) => {
                if (e) {
                    console.error('Globbing error:', e);
                }

                let list = newList.map(nl => {
                    let p = path.resolve(cwd, nl);
                    let type = mg.cache[p] && mg.cache[p] == 'FILE' ? types.FilePathType.File : types.FilePathType.Dir;
                    return {
                        filePath: fsu.consistentPath(p),
                        type,
                    }
                });

                // Initial search complete!
                completed = true;
                list.forEach(entry => liveList[entry.filePath] = entry.type);
                sendNewFileList();
            });
            /** Still send the listing while globbing so user gets immediate feedback */
            mg.on('match', (match) => {
                let p = path.resolve(cwd, match);
                if (mg.cache[p]) {
                    liveList[fsu.consistentPath(p)] = mg.cache[p] == 'FILE' ? types.FilePathType.File : types.FilePathType.Dir;
                    sendNewFileListThrottled();
                }
            });
        })();


        function fileAdded(filePath: string) {
            filePath = fsu.consistentPath(filePath);

            // Only send if we don't know about this already (because of faster initial scan)
            if (!liveList[filePath]) {
                let type = types.FilePathType.File;
                liveList[filePath] = type;
                bufferedAdded.push({
                    filePath,
                    type
                });
                sendNewFileListThrottled();
            }
        }

        function dirAdded(dirPath: string) {
            dirPath = fsu.consistentPath(dirPath);
            liveList[dirPath] = types.FilePathType.Dir;
            bufferedAdded.push({
                filePath: dirPath,
                type: types.FilePathType.Dir
            });

            /**
             * - glob the folder
             * - send the folder throttled
             */
            getListing(dirPath).then(res => {
                res.forEach(fpDetails => {
                    if (!liveList[fpDetails.filePath]) {
                        let type = fpDetails.type
                        liveList[fpDetails.filePath] = type;
                        bufferedAdded.push({
                            filePath: fpDetails.filePath,
                            type
                        });
                    }
                });
                sendNewFileListThrottled();
            }).catch(res => {
                console.error('[FLW] DirPath listing failed:', dirPath, res);
            });
        }

        function fileDeleted(filePath: string) {
            filePath = fsu.consistentPath(filePath);
            delete liveList[filePath];
            bufferedRemoved.push({
                filePath,
                type: types.FilePathType.File
            });
            sendNewFileListThrottled();
        }

        function dirDeleted(dirPath: string) {
            dirPath = fsu.consistentPath(dirPath);
            Object.keys(liveList).forEach(filePath => {
                if (filePath.startsWith(dirPath)) {
                    bufferedRemoved.push({
                        filePath,
                        type: liveList[filePath]
                    });
                    delete liveList[filePath];
                }
            });
            sendNewFileListThrottled();
        }

        /** Create watcher */
        let watcher = chokidar.watch(directoryUnderWatch, { ignoreInitial: true });

        // Just the ones that impact file listing
        // https://github.com/paulmillr/chokidar#methods--events
        watcher.on('add', fileAdded);
        watcher.on('addDir', dirAdded);
        watcher.on('unlink', fileDeleted);
        watcher.on('unlinkDir', dirDeleted);

        // Just for changes
        watcher.on('change', (filePath) => {
            // We have no use for this right now
        });

        return Promise.resolve({});
    }
}

// Ensure that the namespace follows the contract
const _checkTypes: typeof contract.worker = Worker;
// run worker
export const {master} = sw.runWorker({
    workerImplementation: Worker,
    masterContract: contract.master
});

function debug(...args) {
    console.error.apply(console, args);
}
