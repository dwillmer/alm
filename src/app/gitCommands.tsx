/**
 * Registers all the git commands with the server
 */
import * as ui from "./ui";
export import commands = require("./commands/commands");
import {server} from "../socket/socketClient";
import * as CodeMirror from "codemirror";

commands.gitStatus.on(()=>{
    ui.notifyInfoNormalDisappear('Git status coming soon');
    server.gitStatus({}).then(res=>console.log(res));
});

CodeMirror.commands[commands.additionalEditorCommands.gitResetFile] = function(cm: CodeMirror.EditorFromTextArea) {
    if (!cm.filePath){
        ui.notifyWarningNormalDisappear('File does not have a valid file path');
        return;
    }

    server.gitReset({ filePath: cm.filePath }).then((res) => {
        console.log(res);
        ui.notifySuccessNormalDisappear('Git reset successful');
    })
}
