import * as sls from "../socketLib/socketLibServer";
import * as contract from "./socketContract";
import http = require("http");
import https = require("https");
import * as flm from "../server/workers/fileListing/fileListingMaster";
import * as workingDir from "../server/disk/workingDir";
import * as gitService from "../server/workers/external/gitService";
import * as findAndReplaceMultiService from "../server/workers/external/findAndReplaceMultiService";
import * as session from "../server/disk/session";
let resolve = sls.resolve;

import * as fmc from "../server/disk/fileModelCache";
import * as activeProjectConfig from "../server/disk/activeProjectConfig";

import {errorsCache} from "../server/globalErrorCache";
import * as projectServiceMaster from "../server/workers/lang/projectServiceMaster";

namespace Server {
    export var echo: typeof contract.server.echo = (data, client) => {
        console.log('Echo request received:', data);
        return client.increment({ num: data.num }).then((res) => {
            return {
                text: data.text,
                num: res.num
            };
        });
    }

    export var filePaths: typeof contract.server.filePaths = (data) => {
        return flm.filePathsUpdated.current().then(res=> ({ filePaths: res.filePaths, completed: res.completed, rootDir: res.rootDir }));
    }

    export var makeAbsolute: typeof contract.server.makeAbsolute = (data) => {
        return Promise.resolve({ filePath: workingDir.makeAbsolute(data.relativeFilePath) });
    }

    /**
     * File stuff
     */
    export var openFile: typeof contract.server.openFile = (data) => {
        let file = fmc.getOrCreateOpenFile(data.filePath, /*autoCreate*/ true);
        return resolve({ contents: file.getContents(), saved: file.saved(), editorOptions: file.editorOptions });
    }
    export var closeFile: typeof contract.server.openFile = (data) => {
        fmc.closeOpenFile(data.filePath);
        return resolve({});
    }
    export var editFile: typeof contract.server.editFile = (data) => {
        let file = fmc.getOrCreateOpenFile(data.filePath);
        let {saved} = file.edit(data.edit);
        // console.log('-------------------------');
        // console.log(file.getContents());
        return resolve({ saved });
    }
    export var saveFile: typeof contract.server.saveFile = (data) => {
        fmc.saveOpenFile(data.filePath);
        return resolve({});
    }
    export var getFileStatus: typeof contract.server.openFile = (data) => {
        let file = fmc.getOrCreateOpenFile(data.filePath, /*autoCreate*/ true);
        return resolve({ saved: file.saved() });
    }
    export var addFile: typeof contract.server.addFile = (data) => {
        let file = fmc.getOrCreateOpenFile(data.filePath, /*autoCreate*/ true);
        return resolve({ error: null });
    }
    export var deleteFromDisk: typeof contract.server.deleteFromDisk = (data) => {
        let file = fmc.deleteFromDisk(data);
        return resolve({ errors: [] });
    }
    export var duplicateFile: typeof contract.server.duplicateFile = (data) => {
        let file = fmc.duplicateFile(data);
        return resolve({ error: null });
    }
    export var duplicateDir: typeof contract.server.duplicateDir = (data) => {
        return fmc.duplicateDir(data).then(error=>{
            return {error};
        });
    }
    export var movePath: typeof contract.server.movePath = (data) => {
        return fmc.movePath(data).then(error=>{
            return {error};
        });
    }

    /**
     * Config stuff
     */
    export var availableProjects: typeof contract.server.availableProjects = (data) => {
        return activeProjectConfig.availableProjects.current();
    };
    export var getActiveProjectConfigDetails: typeof contract.server.getActiveProjectConfigDetails = (data) => {
        return activeProjectConfig.activeProjectConfigDetailsUpdated.current();
    };
    export var setActiveProjectConfigDetails: typeof contract.server.setActiveProjectConfigDetails = (data) => {
        activeProjectConfig.syncCore(data);
        return resolve({});
    };
    export var isFilePathInActiveProject: typeof contract.server.isFilePathInActiveProject = (data) => {
        return activeProjectConfig.projectFilePathsUpdated.current().then(res => {
            const inActiveProject = res.filePaths.some(fp => fp === data.filePath);
            return { inActiveProject };
        });
    };
    export var setOpenUITabs: typeof contract.server.setOpenUITabs = (data) => {
        session.setOpenUITabs(data.sessionId, data.openTabs);
        return resolve({});
    };
    export var getOpenUITabs: typeof contract.server.getOpenUITabs = (data) => {
        return resolve(session.getOpenUITabs(data.sessionId));
    };
    export var activeProjectFilePaths: typeof contract.server.activeProjectFilePaths = (data) => {
        return activeProjectConfig.projectFilePathsUpdated.current();
    };

    /**
     * Error handling
     */
    export var getErrors: typeof contract.server.getErrors = (data) => {
        return resolve(errorsCache.getErrorsLimited());
    }

    /**
     * Project service
     */
    export var getCompletionsAtPosition : typeof contract.server.getCompletionsAtPosition = projectServiceMaster.worker.getCompletionsAtPosition;
    export var quickInfo : typeof contract.server.quickInfo = projectServiceMaster.worker.quickInfo;
    export var getRenameInfo : typeof contract.server.getRenameInfo = projectServiceMaster.worker.getRenameInfo;
    export var getDefinitionsAtPosition : typeof contract.server.getDefinitionsAtPosition = projectServiceMaster.worker.getDefinitionsAtPosition;
    export var getDoctorInfo : typeof contract.server.getDoctorInfo = projectServiceMaster.worker.getDoctorInfo;
    export var getReferences : typeof contract.server.getReferences = projectServiceMaster.worker.getReferences;
    export var formatDocument : typeof contract.server.formatDocument = projectServiceMaster.worker.formatDocument;
    export var formatDocumentRange : typeof contract.server.formatDocumentRange = projectServiceMaster.worker.formatDocumentRange;
    export var getNavigateToItems : typeof contract.server.getNavigateToItems = projectServiceMaster.worker.getNavigateToItems;
    export var getDependencies : typeof contract.server.getDependencies = projectServiceMaster.worker.getDependencies;
    export var getAST : typeof contract.server.getAST = projectServiceMaster.worker.getAST;

    /**
     * Output Status
     */
    export const getCompleteOutputStatusCache: typeof contract.server.getCompleteOutputStatusCache =
        (data) => {
            return cast.completeOutputStatusCacheUpdated.current
                ? cast.completeOutputStatusCacheUpdated.current()
                : resolve({});
        }

    /**
     * Git service
     */
    export var gitStatus : typeof contract.server.gitStatus = gitService.gitStatus;
    export var gitReset : typeof contract.server.gitReset = gitService.gitReset;

    /**
     * FARM
     */
    export var startFarming : typeof contract.server.startFarming = findAndReplaceMultiService.startFarming;
    export var stopFarmingIfRunning : typeof contract.server.stopFarmingIfRunning = findAndReplaceMultiService.stopFarmingIfRunning;
    export var farmResults: typeof contract.server.farmResults = (query:{}) => findAndReplaceMultiService.farmResultsUpdated.current();
}

// Ensure that the namespace follows the contract
var _checkTypes: typeof contract.server = Server;

/** Will be available after register is called */
export let cast = contract.cast;

/** launch server */
export function register(app: http.Server | https.Server) {
    let runResult = sls.run({
        app,
        serverImplementation: Server,
        clientContract: contract.client,
        cast: contract.cast
    });
    cast = runResult.cast;

    /** File model */
    fmc.savedFileChangedOnDisk.pipe(cast.savedFileChangedOnDisk);
    fmc.didEdit.pipe(cast.didEdit);
    fmc.didStatusChange.pipe(cast.didStatusChange);
    fmc.editorOptionsChanged.pipe(cast.editorOptionsChanged);

    /** File listing updates */
    flm.filePathsUpdated.pipe(cast.filePathsUpdated);

    /** Active Project */
    activeProjectConfig.availableProjects.pipe(cast.availableProjectsUpdated);
    activeProjectConfig.activeProjectConfigDetailsUpdated.pipe(cast.activeProjectConfigDetailsUpdated);
    activeProjectConfig.projectFilePathsUpdated.pipe(cast.activeProjectFilePathsUpdated);
    activeProjectConfig.errorsInTsconfig.errorsDelta.on((delta) => errorsCache.applyDelta(delta));

    /** Errors */
    errorsCache.errorsUpdated.pipe(cast.errorsUpdated);

    /** FARM */
    findAndReplaceMultiService.farmResultsUpdated.pipe(cast.farmResultsUpdated);

    /** JS Output Status */
    projectServiceMaster.fileOutputStatusUpdated.pipe(cast.fileOutputStatusUpdated);
    projectServiceMaster.completeOutputStatusCacheUpdated.pipe(cast.completeOutputStatusCacheUpdated);

    // For testing
    // setInterval(() => cast.hello.emit({ text: 'nice' }), 1000);
}
