import {createMap}  from "../../../../common/utils";
import * as types from "../../../../common/types";
import * as typescriptDir from "./typeScriptDir";

import {master as masterType} from "../projectServiceContract";
let master: typeof masterType;
export function setMaster(m: typeof masterType) {
    master = m;
}

import * as lsh from "../../../../languageServiceHost/languageServiceHost";

/**
 * Wraps up `langaugeService` `languageServiceHost` and `projectFile` in a single package
 */
export class Project {
    public languageServiceHost: LanguageServiceHost;
    public languageService: ts.LanguageService;
    public configFile: types.TypeScriptConfigFileDetails;

    constructor(projectData: types.ProjectDataLoaded) {
        this.configFile = projectData.configFile;

        this.languageServiceHost = new LanguageServiceHost(projectData.configFile.project.compilerOptions);

        // Add all the files
        projectData.filePathWithContents.forEach(({filePath,contents}) => {
            this.languageServiceHost.addScript(filePath, contents);
        });

        this.languageService = ts.createLanguageService(this.languageServiceHost, ts.createDocumentRegistry());
    }

    /**
     * all files except lib.d.ts
     * Note: this function is exceedingly slow on cold boot (13s on vscode codebase) as it calls getProgram.getSourceFiles
     */
    public getProjectSourceFiles(): ts.SourceFile[] {
        var libFileLookup = createMap(typescriptDir.getDefaultLibFilePaths(this.configFile.project.compilerOptions));
        var files
            = this.languageService.getProgram().getSourceFiles().filter(x=> !libFileLookup[x.fileName]);
        return files;
    }

    public includesSourceFile(filePath: string) {
        return (this.configFile.project.files.filter((f) => f === filePath).length === 1);
    }

    public getFilePaths(): string[]{
        return (this.configFile.project.files);
    }

    public getDiagnosticsForFile(filePath: string) {
        var diagnostics = this.languageService.getSyntacticDiagnostics(filePath);
        if (diagnostics.length === 0) {
            diagnostics = this.languageService.getSemanticDiagnostics(filePath);
        }
        return diagnostics;
    }

    public getDiagnostics() {
        const program = this.languageService.getProgram();

        return program.getGlobalDiagnostics()
            .concat(program.getSemanticDiagnostics())
            .concat(program.getSyntacticDiagnostics());
    }
}

/**
 * Similar to the base, just adds stuff that uses `require.resolve` to load lib.d.ts
 */
export class LanguageServiceHost extends lsh.LanguageServiceHost {
    getDefaultLibFileName = () => typescriptDir.getDefaultLibFilePaths(this.compilerOptions)[0];
}
