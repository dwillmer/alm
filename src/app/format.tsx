import * as uix from "./uix";
import * as commands from "./commands/commands";
import CodeMirror = require('codemirror');
import {server} from "../socket/socketClient";
import {EditorOptions} from "../common/types";

// Wire up the code mirror command to come here
CodeMirror.commands[commands.additionalEditorCommands.format] = (editor: CodeMirror.EditorFromTextArea) => {
    let doc = editor.getDoc();
    let filePath = editor.filePath;

    const indentUnit = editor.getOption('indentUnit');
    const tabSize = editor.getOption('tabSize');
    const indentWithTabs = editor.getOption('indentWithTabs');
    let editorOptions: EditorOptions = {
        indentSize: indentUnit,
        tabSize: tabSize,
        newLineCharacter: '\n',
        convertTabsToSpaces: !indentWithTabs
    }

    if (doc.somethingSelected()){
        var selection = doc.listSelections()[0]; // only the first is formatted at the moment
        let from = selection.anchor;
        let to = selection.head;

        server.formatDocumentRange({
            from,to,filePath,editorOptions
        }).then(res=> {
            uix.API.applyRefactorings(res.refactorings);
        });
    }
    else {
        server.formatDocument({
            filePath,editorOptions
        }).then(res=> {
            uix.API.applyRefactorings(res.refactorings);
        });
    }
}
