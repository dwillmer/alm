/**
 * This file is mostly for sharing code between code and template(aka snippet) autocompletes
 */

/**
 * Exists to allow us to pass throught the `original` information around.
 * Code mirror insists on using `CodeMirror.Hint` so we use that
 * But then we put the good stuff in `original` and use it in `render` and `complete` and `move` etc
 */
import * as types from "../../../../common/types";
export interface ExtendedCodeMirrorHint extends CodeMirror.Hint {
    original?: types.Completion;
    /** For rending matched segments */
    queryString?: string;
}

/**
 * For highlighting matched segments
 */
import {renderMatchedSegments} from "../../../selectListView";
import * as ReactServer from "react-dom/server";
import * as React from "react";

/**
 * Key strokes can have different effect based on this state
 * So moved this check out into a utility
 */
export function isCompletionActive(ed: CodeMirror.EditorFromTextArea): boolean {
    return !!(ed as any).state.completionActive;
}

/**
 * A common shared render function
 */
import {kindToColor, kindToIcon} from "../../../ui";
namespace AutocompleteStyles {
    /**
     * We have a rows of hints with each hint being
     * `leftLeft`  `left`      `main`        `right`
     * icon        for type    for content   for docs
     */
    export const leftLeftClassName = 'cm-hint left-left';
    export const leftClassName = 'cm-hint left';
    export const mainClassName = 'cm-hint main';
    export const rightClassName = 'cm-hint right';
}
export function render(elt: HTMLLIElement, data: CodeMirror.Hints, cur: ExtendedCodeMirrorHint) {
    let original: types.Completion = cur.original;
    let color = kindToColor(original.kind);
    let colorBackground = kindToColor(original.kind, true);
    let icon = kindToIcon(original.kind);
    const text = cur.queryString ? ReactServer.renderToString(<span>{renderMatchedSegments(original.name,cur.queryString)}</span>) : original.name;

    elt.innerHTML = `
        <span class="${AutocompleteStyles.leftLeftClassName}" style="color:${color};background:${colorBackground}">${icon}</span>
        <strong class="${AutocompleteStyles.leftClassName}" style="color:${color};background:${colorBackground}">${original.kind}</strong>
        <span class="${AutocompleteStyles.mainClassName}">${text}</span>
        <span class="${AutocompleteStyles.rightClassName}">${original.display}</span>
    `.replace(/\s+/g,' ');
}
