/**
 * This module is responsible for reading (with error reporting) the tsconfig.json
 *
 * - It will emit the relevant information (configFile) for use by the project service if all good
 * - It will emit the errors in the configFile or ask to clear them if needed
 * - It will emit the available projects
 *
 * Note: When the app starts the active project is determined by `session.ts`
 */

import {TypedEvent} from "../../common/events";
import * as utils from "../../common/utils";
import * as tsconfig from "../workers/lang/core/tsconfig";
import * as types from "../../common/types";
import {AvailableProjectConfig} from "../../common/types";

/** Disk access / session stuff */
import * as session from "./session";
import * as fmc from "./fileModelCache";
import * as flm from "../workers/fileListing/fileListingMaster";
import * as workingDir from "./workingDir";
import * as fsu from "../utils/fsu";

/**
 * Global variables
 */
/** The active project name */
let activeProjectConfigDetails: AvailableProjectConfig = null;
export let activeProjectConfigDetailsUpdated = new TypedEvent<AvailableProjectConfig>();

/** Only if the file is valid will we end up here */
let configFile: types.TypeScriptConfigFileDetails = null;
export let configFileUpdated = new TypedEvent<types.TypeScriptConfigFileDetails>();
export let projectFilePathsUpdated = new TypedEvent<{ filePaths: string[] }>();

/**
 * Errors in tsconfig.json
 */
import {ErrorsCache} from "../utils/errorsCache";
export const errorsInTsconfig = new ErrorsCache();
function setErrorsInTsconfig(filePath:string, errors:CodeError[]){
    console.log('TSCONFIG: Error', errors[0].message);
    errorsInTsconfig.setErrorsByFilePaths([filePath], errors);
}
function clearErrorsInTsconfig(filePath:string){
    console.log('TSCONFIG: All Good!', filePath);
    errorsInTsconfig.clearErrors();
}

/** The name used if we don't find a project */
const implicitProjectName = "__auto__";

/**
 * on server start
 */
export function start() {
    // Keep session on disk in sync
    activeProjectConfigDetailsUpdated.on((ap)=>{
        if (ap.tsconfigFilePath) {
            session.setTsconfigPath(ap.tsconfigFilePath);
        }
    });

    // Helps us sync only once in the beginning
    let synced = false;

    // Resume session
    let ses = session.readDiskSessionsFile();
    if (ses.relativePathToTsconfig) {
        let tsconfig = workingDir.makeAbsolute(ses.relativePathToTsconfig);
        if (fsu.existsSync(tsconfig)) {
            activeProjectConfigDetails = Utils.tsconfigToActiveProjectConfigDetails(tsconfig);
            activeProjectConfigDetailsUpdated.emit(activeProjectConfigDetails);
            syncCore(activeProjectConfigDetails);
            synced = true;
        }
    }

    refreshAvailableProjects()
        .then(() => !synced && sync());
}

/** All the available projects */
export const availableProjects = new TypedEvent<AvailableProjectConfig[]>();
function refreshAvailableProjects() {
    return flm.filePathsCompleted.current().then((list) => {
        // Detect some tsconfig.json
        let tsconfigs = list.filePaths.map(t=> t.filePath).filter(t=> t.endsWith('tsconfig.json'));
        // sort by shortest length first (with extra big weight for node_modules):
        let weightConfig = (config: string) => config.includes('node_modules') ? config.length + 100 : config.length;
        tsconfigs = tsconfigs.sort(function(a, b) {
            return weightConfig(a) - weightConfig(b);
        });

        let projectConfigs: AvailableProjectConfig[] = tsconfigs.map(Utils.tsconfigToActiveProjectConfigDetails);

        // If no tsconfigs add an implicit one!
        if (projectConfigs.length == 0) {
            projectConfigs.push({
                name: implicitProjectName,
                isImplicit: true,
            });
        };

        availableProjects.emit(projectConfigs);
    });
}

/** General purpose utility functions specific to this file */
namespace Utils {
    export function tsconfigToActiveProjectConfigDetails(tsconfig: string): AvailableProjectConfig {
        let relative = workingDir.makeRelative(tsconfig);
        let isNodeModule = relative.includes('node_modules');
        return {
            name: isNodeModule ? relative : utils.getDirectoryAndFileName(tsconfig),
            isImplicit: false,
            tsconfigFilePath: tsconfig
        };
    }
}

/** convert project name to current project */
export function sync() {
    availableProjects.current().then((projectConfigs) => {
        let activeProjectName = (activeProjectConfigDetails && activeProjectConfigDetails.name);
        // we are guaranteed as least one project config (which just might be the implicit one)
        let projectConfig = projectConfigs.filter(x=>x.name == activeProjectName)[0] || projectConfigs[0];
        syncCore(projectConfig);
    });
}

/** ensures that the `projectConfig` can actually be parsed. If so propogates the set event. */
export function syncCore(projectConfig:AvailableProjectConfig){
    let activeProjectName = (activeProjectConfigDetails && activeProjectConfigDetails.name);
    configFile = ConfigFile.getConfigFileFromDiskOrInMemory(projectConfig);

    // In case of error we exit as `ConfigFile.getConfigFileFromDiskOrInMemory` already does the error reporting
    if (!configFile) return;

    configFileUpdated.emit(configFile);
    projectFilePathsUpdated.emit({ filePaths: configFile.project.files });

    // Set the active project (the project we get returned might not be the active project name)
    activeProjectConfigDetails = projectConfig;
    activeProjectConfigDetailsUpdated.emit(activeProjectConfigDetails);
}

/**
 * Utility functions to convert a configFilePath into `configFile`
 */
import fs = require("fs");
import path = require("path");
namespace ConfigFile {
    const typescriptDirectory = path.dirname(require.resolve('ntypescript')).split('\\').join('/');

    /**
     * This explicilty loads the project from the filesystem
     * For (lib.d.ts) and other (.d.ts files where project is not found) creation is done in memory
     */
    export function getConfigFileFromDiskOrInMemory(config: AvailableProjectConfig): types.TypeScriptConfigFileDetails {
        if (!config.tsconfigFilePath) {
            // TODO: THIS isn't RIGHT ...
            // as this function is designed to work *from a single source file*.
            // we need one thats designed to work from *all source files*.
            return tsconfig.getDefaultInMemoryProject(process.cwd());
        }

        const filePath = config.tsconfigFilePath;

        // If we are asked to look at stuff in lib.d.ts create its own project
        if (path.dirname(filePath) == typescriptDirectory) {
            return tsconfig.getDefaultInMemoryProject(filePath);
        }

        const {result:projectFile, error} = tsconfig.getProjectSync(filePath);
        if (!error){
            clearErrorsInTsconfig(projectFile.projectFilePath);
            return projectFile;
        }
        else {
            // If we have a .d.ts file then it is its own project and return
            if (filePath.toLowerCase().endsWith('.d.ts')) {
                return tsconfig.getDefaultInMemoryProject(filePath);
            }
            setErrorsInTsconfig(filePath, [error]);
        }
        return undefined;
    }
}

/**
 * As soon as we get a new file listing refresh available projects
 */
flm.filePathsUpdated.on(function(data) {
    refreshAvailableProjects();
});

/**
 * As soon as edit happens on the project file do a sync
 */
function checkProjectFileChanges(evt: { filePath: string }) {
    let currentConfigFilePath = activeProjectConfigDetails && activeProjectConfigDetails.tsconfigFilePath;
    if (evt.filePath == currentConfigFilePath) {
        sync();
    }
}
fmc.didEdit.on(checkProjectFileChanges);
fmc.savedFileChangedOnDisk.on(checkProjectFileChanges);
