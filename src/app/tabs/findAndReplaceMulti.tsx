import * as ui from "../ui";
import * as csx from "csx";
import * as React from "react";
import ReactDOM = require("react-dom");
import * as tab from "./tab";
import {server, cast} from "../../socket/socketClient";
import * as commands from "../commands/commands";
import * as utils from "../../common/utils";
import * as styles from "../styles/styles";
import {Types} from "../../socket/socketContract";
import {Icon} from "../icon";
import * as Mousetrap from "mousetrap";
import * as pure from "../../common/pure";

type NodeDisplay = Types.NodeDisplay;
let EOL = '\n';

/**
 * The styles
 */
let {inputBlackStyle} = styles.Input;
import {inputCodeStyle, searchOptionsLabelStyle}
from "../findAndReplace";

namespace ResultsStyles {
    export const root = csx.extend(
        csx.flex,
        csx.scroll,
        styles.padded1,
        {
            border: '1px solid grey',
            ':focus': {
                outline: 'none',
                border: '1px solid ' + styles.highlightColor,
            }
        }
    );

    export const header = csx.extend(
        styles.padded1,
        {
            cursor: 'default',
            fontSize: '1.5em',
            fontWeight: 'bold',
            color: styles.textColor,
            background: 'black',
            border:'2px solid grey',
        }
    );

    export let preview = {
        padding: '3px',
        background: 'black',
        cursor: 'pointer',
        userSelect: 'text',
    }

    export let selected = {
        backgroundColor: styles.selectedBackgroundColor
    };
}

/**
 * Props / State
 */
export interface Props extends tab.ComponentProps {
}
export interface State {
    completed?:boolean;
    results?: Types.FarmResultDetails[];
    config?: Types.FarmConfig;
    farmResultByFilePath?: Types.FarmResultsByFilePath;

    /**
     * Results view state
     */
    collapsedState?: { [filePath: string]: boolean };
    selected?: {
        filePath?: string;
        /* If we have a filePath selected (instead of a search result) we set this to -1*/
        line?: number;
    };
    queryRegex?: RegExp;

    /**
     * Search state
     */
    findQuery?: string;
    replaceQuery?: string;
    isRegex?: boolean;
    isCaseSensitive?: boolean;
    isFullWord?: boolean;
}

@ui.Radium
export class FindAndReplaceView extends ui.BaseComponent<Props, State> implements tab.Component {
    constructor(props: Props) {
        super(props);
        let {protocol, filePath} = utils.getFilePathAndProtocolFromUrl(props.url);
        this.filePath = filePath;
        this.state = {
            completed: true,
            farmResultByFilePath: {},

            collapsedState: {},
            selected:{},
        };
    }

    filePath: string;
    mode: Types.ASTMode;
    componentDidMount() {
        /**
         * Keyboard: Focus
         */
        this.focusOnInput(); // On initial mount as well :)
        this.disposible.add(commands.findAndReplace.on(this.focusOnInput));
        this.disposible.add(commands.findAndReplaceMulti.on(this.focusOnInput));

        /**
         * Keyboard: Stop
         */
        this.disposible.add(commands.esc.on(() => {
            // Disabled as esc is used to focus search results as well
            // this.cancelAnyRunningSearch();
        }));

        /**
         * Initial load && keeping it updated
         */
        server.farmResults({}).then(res => {
            this.parseResults(res);
        });
        this.disposible.add(cast.farmResultsUpdated.on(res=>{
            this.parseResults(res);
        }));

        /**
         * Handle the keyboard in the search results
         */
        let treeRoot = this.refs.results;
        let handlers = new Mousetrap(treeRoot);

        let selectFirst = () => {
            if (this.state.results && this.state.results.length) {
                this.setSelected(this.state.results[0].filePath, -1);
            }
        }
        handlers.bind('up',()=>{
            // initial state
            if (!this.state.results || !this.state.results.length) return false;
            if (!this.state.selected.filePath){
                selectFirst();
                return false;
            }
            /** If we have an actual line go to previous or filePath */
            if (this.state.selected.line !== -1){
                const relevantResults = this.state.farmResultByFilePath[this.state.selected.filePath];
                const indexInResults
                    = relevantResults
                        .map(x=>x.line)
                        .indexOf(this.state.selected.line);
                if (indexInResults === 0){
                    this.setSelected(this.state.selected.filePath, -1)
                }
                else {
                    this.setSelected(this.state.selected.filePath, relevantResults[indexInResults - 1].line);
                }
            }
            /** Else go to the previous filePath (if any)
                (collapsed) the filePath
                (expanded) last child
             */
            else {
                let filePaths = Object.keys(this.state.farmResultByFilePath);
                let filePathIndex = filePaths.indexOf(this.state.selected.filePath);
                if (filePathIndex === 0) return false;
                let previousFilePath = filePaths[filePathIndex - 1];
                if (this.state.collapsedState[previousFilePath]){
                    this.setSelected(previousFilePath, -1);
                }
                else {
                    let results = this.state.farmResultByFilePath[previousFilePath];
                    this.setSelected(previousFilePath, results[results.length - 1].line);
                }
            }
            return false;
        });
        handlers.bind('down',()=>{
            if (!this.state.results || !this.state.results.length) return false;
            if (!this.state.selected.filePath) {
                selectFirst();
                return false;
            }
            /** If we are on a filePath
                (collaped) go to next filePath if any
                (expanded) go to first child */
            if (this.state.selected.line === -1) {
                if (this.state.collapsedState[this.state.selected.filePath]){
                    let filePaths = Object.keys(this.state.farmResultByFilePath);
                    let filePathIndex = filePaths.indexOf(this.state.selected.filePath);
                    if (filePathIndex === filePaths.length - 1) return false;
                    let nextFilePath = filePaths[filePathIndex + 1];
                    this.setSelected(nextFilePath, -1);
                }
                else {
                    let results = this.state.farmResultByFilePath[this.state.selected.filePath];
                    this.setSelected(results[0].filePath, results[0].line);
                }
            }
            /** Else if last in the group go to next filePath if any, otherwise goto next sibling */
            else {
                let results = this.state.farmResultByFilePath[this.state.selected.filePath];
                let indexIntoResults = results.map(x => x.line).indexOf(this.state.selected.line);
                if (indexIntoResults === results.length - 1) {
                    // Goto next filePath if any
                    let filePaths = Object.keys(this.state.farmResultByFilePath);
                    let filePathIndex = filePaths.indexOf(this.state.selected.filePath);
                    if (filePathIndex === filePaths.length - 1) return false;
                    let nextFilePath = filePaths[filePathIndex + 1];
                    this.setSelected(nextFilePath, -1);
                }
                else {
                    let nextResult = results[indexIntoResults + 1];
                    this.setSelected(nextResult.filePath, nextResult.line);
                }
            }
            return false;
        });
        handlers.bind('left', () => {
            /** Just select and collapse the folder irrespective of our current state */
            if (!this.state.results || !this.state.results.length) return false;
            if (!this.state.selected.filePath) return false;
            this.state.collapsedState[this.state.selected.filePath] = true;
            this.setState({collapsedState: this.state.collapsedState});
            this.setSelected(this.state.selected.filePath, -1);
            return false;
        });
        handlers.bind('right', () => {
            /** Expand only if a filePath root is currently selected  */
            if (!this.state.results || !this.state.results.length) return false;
            this.state.collapsedState[this.state.selected.filePath] = false;
            this.setState({collapsedState: this.state.collapsedState});
            return false;
        });
        handlers.bind('enter',()=>{
            /** Enter always takes you into the filePath */
            if (!this.state.results || !this.state.results.length) return false;
            if (!this.state.selected.filePath) {
                selectFirst();
            }
            this.openSearchResult(this.state.selected.filePath, this.state.selected.line);
            return false;
        });
    }

    refs: {
        [string: string]: any;
        results: HTMLDivElement;

        find: JSX.Element;
        replace: JSX.Element;
        regex: { refs: { input: JSX.Element } };
        caseInsensitive: { refs: { input: JSX.Element } };
        fullWord: { refs: { input: JSX.Element } };
    }
    findInput = (): HTMLInputElement => ReactDOM.findDOMNode(this.refs.find);
    replaceInput = (): HTMLInputElement => ReactDOM.findDOMNode(this.refs.replace);
    regexInput = (): HTMLInputElement => ReactDOM.findDOMNode(this.refs.regex.refs.input);
    caseInsensitiveInput = (): HTMLInputElement => ReactDOM.findDOMNode(this.refs.caseInsensitive.refs.input);
    fullWordInput = (): HTMLInputElement => ReactDOM.findDOMNode(this.refs.fullWord.refs.input);

    replaceWith = () => this.replaceInput().value;

    render() {
        let hasResults = !!Object.keys(this.state.farmResultByFilePath).length;

        let rendered = (
            <div
                style={csx.extend(csx.vertical, csx.flex, styles.noFocusOutline, styles.someChildWillScroll) }>
                <div ref="results" tabIndex={0} style={ResultsStyles.root}>
                    {
                        hasResults
                            ? this.renderSearchResults()
                            : <div style={ResultsStyles.header}>No Search</div>
                    }
                </div>
                <div style={csx.extend(csx.content, styles.padded1) }>
                    {
                        this.renderSearchControls()
                    }
                </div>
            </div>
        );

        return rendered;
    }

    renderSearchControls() {
        return (
            <div style={csx.vertical}>
                <div style={[csx.horizontal, csx.center]}>
                    <div style={[csx.flex, csx.vertical]}>
                        <div style={[csx.horizontal, csx.center, styles.padded1]}>
                            <input tabIndex={1} ref="find"
                                placeholder="Find"
                                style={[inputBlackStyle, inputCodeStyle, csx.flex]}
                                onKeyDown={this.findKeyDownHandler}
                                onChange={this.findChanged} defaultValue={''}/>
                        </div>
                        {
                            /* I have disabled replaced as this is not the core focus of this application
                            <div style={[csx.horizontal, csx.center, styles.padded1]}>
                                <input tabIndex={2} ref="replace"
                                    placeholder="Replace"
                                    style={[inputBlackStyle, inputCodeStyle, csx.flex]}
                                    onKeyDown={this.replaceKeyDownHandler} />
                            </div>
                            */
                        }
                    </div>
                    <div style={[csx.content]}>
                        <div style={[csx.horizontal, csx.aroundJustified, styles.padded1]}>
                            <label style={[csx.horizontal, csx.center]}>
                                <ui.Toggle
                                    tabIndex={3}
                                    ref="regex"
                                    onChange={this.handleRegexChange}/>
                                <span style={searchOptionsLabelStyle}>
                                    .*
                                </span>
                            </label>
                            <label style={[csx.horizontal, csx.center]}>
                                <ui.Toggle
                                    tabIndex={4}
                                    ref="caseInsensitive"
                                    onChange={this.handleCaseSensitiveChange}/>
                                <span style={searchOptionsLabelStyle}>
                                    Aa
                                </span>
                            </label>
                            <label style={[csx.horizontal, csx.center]}>
                                <ui.Toggle
                                    tabIndex={5}
                                    ref="fullWord"
                                    onKeyDown={this.fullWordKeyDownHandler}
                                    onChange={this.handleFullWordChange}/>
                                <span style={searchOptionsLabelStyle}>
                                    <Icon name="text-width"/>
                                </span>
                            </label>
                        </div>
                    </div>
                </div>
                <div style={[styles.Tip.root]}>
                    <div>
                    Controls:
                    {' '}<span style={styles.Tip.keyboardShortCutStyle}>Esc</span> to focus on results
                    {' '}<span style={styles.Tip.keyboardShortCutStyle}>Enter</span> to start/restart search
                    {' '}<span style={styles.Tip.keyboardShortCutStyle}>Toggle 🔘 switches</span> start/restart search
                    </div>
                    <div>
                    Results:
                    {' '}<span style={styles.Tip.keyboardShortCutStyle}>Up/Down</span> to go through results
                    {' '}<span style={styles.Tip.keyboardShortCutStyle}>Enter</span> to open a search result
                    </div>

                    {
                        /* Disabled Replace as that is not the core focus of my work at the moment
                        {' '}<span style={styles.Tip.keyboardShortCutStyle}>{commands.modName} + Enter</span> to replace
                        {' '}<span style={styles.Tip.keyboardShortCutStyle}>{commands.modName} + Shift + Enter</span> to replace all
                        */
                    }
                </div>
            </div>
        );
    }

    renderSearchResults(){
        let filePaths = Object.keys(this.state.farmResultByFilePath);
        let queryRegex = this.state.queryRegex;
        let queryRegexStr = (this.state.queryRegex && this.state.queryRegex.toString()) || '';
        queryRegexStr = queryRegexStr && ` (Query : ${queryRegexStr}) `

        return (
            <div style={csx.extend(csx.flex, styles.errorsPanel.main, {userSelect:'none'}) }>
                <div style={[ResultsStyles.header, csx.horizontal]}>
                    Total Results ({this.state.results.length})
                    <span style={csx.flex}/>
                    {queryRegexStr}
                    {
                        !this.state.completed &&
                            <button
                                key="button"
                                onClick={this.cancelAnyRunningSearch}
                                style={styles.Button.buttonBlackStyle}>
                                Cancel
                            </button>
                    }
                </div>
                {
                    filePaths.map((filePath, i) => {
                            let results = this.state.farmResultByFilePath[filePath];
                            let selectedRoot = filePath === this.state.selected.filePath && this.state.selected.line == -1
                            let selectedResultLine =
                                filePath === this.state.selected.filePath ? this.state.selected.line : -2 /* -2 means not selected */;

                            return (
                                <FileResults.FileResults
                                    key={i}
                                    ref={filePath}
                                    filePath={filePath}
                                    results={results}
                                    queryRegex={this.state.queryRegex}
                                    expanded={!this.state.collapsedState[filePath]}
                                    onClickFilePath={this.toggleFilePathExpansion}
                                    openSearchResult={this.openSearchResult}
                                    selectedRoot={selectedRoot}
                                    selectedResultLine={selectedResultLine}
                                />
                            );
                        })
                }
            </div>
        );
    }

    toggleFilePathExpansion = (filePath: string) => {
        this.state.collapsedState[filePath] = !this.state.collapsedState[filePath];
        this.setState({collapsedState: this.state.collapsedState, selected:{filePath,line:-1}});
    }

    /**
     * Scrolling through results
     */
    resultRef(filePath: string) {
        const ref = filePath;
        return this.refs[ref] as FileResults.FileResults;
    }

    /**
     * Input Change handlers
     */
    fullWordKeyDownHandler = (e: React.SyntheticEvent) => {
        let {tab, shift, enter} = ui.getKeyStates(e);

        if (tab && !shift) {
            this.findInput().focus();
            e.preventDefault();
            return;
        }
    };
    findKeyDownHandler = (e: React.SyntheticEvent) => {
        let {tab, shift, enter, mod} = ui.getKeyStates(e);

        if (shift && tab) {
            this.fullWordInput() && this.fullWordInput().focus();
            e.preventDefault();
            return;
        }

        /**
         * Handling commit
         */
        if (!this.state.findQuery) {
            return;
        }
        if (enter) {
            this.startSearch();
        }
    };
    replaceKeyDownHandler = (e: React.SyntheticEvent) => {
        let {tab, shift, enter, mod} = ui.getKeyStates(e);

        /**
         * Handling commit
         */
        if (!this.state.findQuery) {
            return;
        }
        if (mod && enter) {
            commands.replaceAll.emit({ newText: this.replaceWith() });
            return;
        }
        if (shift && enter) {
            commands.replacePrevious.emit({ newText: this.replaceWith() });
            return;
        }
        if (enter) {
            commands.replaceNext.emit({ newText: this.replaceWith() });
            return;
        }
    };
    findChanged = () => {
        let val = this.findInput().value.trim();
        this.setState({ findQuery: val });
    };
    handleRegexChange = (e) => {
        let val: boolean = e.target.checked;
        this.setState({ isRegex: val });
        this.startSearch();
    }
    handleCaseSensitiveChange = (e) => {
        let val: boolean = e.target.checked;
        this.setState({ isCaseSensitive: val });
        this.startSearch();
    }
    handleFullWordChange = (e) => {
        let val: boolean = e.target.checked;
        this.setState({ isFullWord: val });
        this.startSearch();
    }

    /**
     * Sends the search query
     * debounced as state needs to be set before this execs
     */
    startSearch = utils.debounce(() => {
        server.startFarming({
            query: this.state.findQuery,
            isRegex: this.state.isRegex,
            isFullWord: this.state.isFullWord,
            isCaseSensitive: this.state.isCaseSensitive,
            globs: []
        });

        this.setState({
            collapsedState:{},
            selected:{},
        });
    },100);

    cancelAnyRunningSearch = () => {
        server.stopFarmingIfRunning({});
    };

    /** Parses results as they come and puts them into the state */
    parseResults(response:Types.FarmNotification){
        // Convert as needed
        // console.log(response.results);
        let results = response.results;
        let loaded: Types.FarmResultsByFilePath
            = utils.createMapByKey(results, result => result.filePath);

        let queryRegex = response.results.length
        ? utils.findOptionsToQueryRegex({
            query: response.config.query,
            isRegex: response.config.isRegex,
            isFullWord: response.config.isFullWord,
            isCaseSensitive: response.config.isCaseSensitive,
        })
        : null; // If there are no results the regex doesn't matter anyway

        // Finally rerender
        this.setState({
            results: results,
            config: response.config,
            queryRegex,
            completed: response.completed,
            farmResultByFilePath: loaded
        });
    }

    openSearchResult = (filePath: string, line: number) => {
        commands.doOpenOrFocusFile.emit({ filePath, position: { line: line - 1, ch: 0 } });
        this.setSelected(filePath,line);
    }

    setSelected = (filePath: string, line: number) => {
        this.setState({ selected: { filePath, line } });
        this.focusFilePath(filePath, line);
    }

    focusFilePath = (filePath: string, line: number) => {
        this.resultRef(filePath).focus(filePath,line);
    };

    /**
     * TAB implementation
     */
    /** Allows us to focus on input on certain keystrokes instead of search results */
    focusOnInput = () => setTimeout(()=>this.findInput().focus(),500);
    focus = () => {
        this.refs.results.focus();
    }

    save = () => {
    }

    close = () => {
    }

    gotoPosition = (position: EditorPosition) => {
    }

    search = {
        doSearch: (options: FindOptions) => {
            // not needed
        },

        hideSearch: () => {
            // not needed
        },

        findNext: (options: FindOptions) => {
        },

        findPrevious: (options: FindOptions) => {
        },

        replaceNext: (newText: string) => {
        },

        replacePrevious: (newText: string) => {
        },

        replaceAll: (newText: string) => {
        }
    }
}

namespace FileResults {
    export interface Props {
        filePath:string;
        results:Types.FarmResultDetails[];

        expanded: boolean;
        onClickFilePath: (filePath:string) => any;
        openSearchResult: (filePath:string, line: number) => any;

        selectedRoot: boolean;
        selectedResultLine: number;

        queryRegex: RegExp;
    }
    export interface State {
    }
    @ui.Radium
    export class FileResults extends React.Component<Props,State>{
        shouldComponentUpdate = pure.shouldComponentUpdate;

        render(){

            let selectedStyle = this.props.selectedRoot
                ? ResultsStyles.selected
                : {};

            return (
                <div onClick={()=>this.props.onClickFilePath(this.props.filePath)}>
                    <div
                        ref={this.props.filePath + ':' + -1}
                        tabIndex={0}
                        style={
                            csx.extend(
                                selectedStyle,
                                styles.errorsPanel.filePath,
                                {
                                    margin:'8px 0px',
                                    padding: '3px' ,
                                    ':focus': {
                                        outline: 'none',
                                    }
                                }
                            )
                        }>
                        {!this.props.expanded ? "+" : "-" } {this.props.filePath} ({this.props.results.length})
                    </div>
                    {!this.props.expanded ? <noscript/> : this.renderResultsForFilePath(this.props.results) }
                </div>
            );
        }

        renderResultsForFilePath = (results:Types.FarmResultDetails[]) => {
            return results.map((result,i)=>{
                let selectedStyle = this.props.selectedResultLine === result.line
                    ? ResultsStyles.selected
                    : {};

                return (
                    <div
                        key={i}
                        ref={result.filePath + ':' + result.line}
                        tabIndex={0}
                        style={
                            csx.extend(
                                styles.padded1,
                                {
                                    cursor: 'pointer',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'pre',
                                    ':focus': {
                                        outline: 'none',
                                    }
                                },
                                selectedStyle
                            )
                        }
                        onClick={(e) => {e.stopPropagation(); this.props.openSearchResult(result.filePath, result.line)} }>
                        {utils.padLeft((result.line).toString(),6)} : <span style={ResultsStyles.preview}>{this.renderMatched(result.preview,this.props.queryRegex)}</span>
                    </div>
                );
            })
        }

        focus(filePath:string, line:number){
            let dom = this.refs[this.props.filePath+':'+line] as HTMLDivElement;
            dom.scrollIntoViewIfNeeded(false);
        }

        renderMatched(preview: string, queryRegex: RegExp){
            let matched = this.getMatchedSegments(preview, queryRegex);
            let matchedStyle = {fontWeight:'bold', color:'#66d9ef'};
            return matched.map((item, i) => {
                return <span key={i} style={item.matched?matchedStyle:{}}>{item.str}</span>;
            });
        }

        getMatchedSegments(preview: string, queryRegex: RegExp) {
            // A data structure which is efficient to render
            type MatchedSegments = { str: string, matched: boolean }[];
            let result: MatchedSegments = [];

            var match;
            let previewCollectedIndex = 0;
            let collectUnmatched = (matchStart:number, matchLength: number) => {
                if (previewCollectedIndex < matchStart) {
                    result.push({
                        str:preview.substring(previewCollectedIndex,matchStart),
                        matched: false
                    });
                    previewCollectedIndex = (matchStart + matchLength);
                }
            };

            while (match = queryRegex.exec(preview)) {
                let matchStart = match.index;
                let matchLength = match[0].length;
                // let nextMatchStart = queryRegex.lastIndex; // Since we don't need it

                // If we have an unmatched string portion that is still not collected
                // Collect it :)
                collectUnmatched(matchStart, matchLength);

                result.push({
                    str: preview.substr(matchStart, matchLength),
                    matched: true
                });
            }

            // If we still have some string portion uncollected, collect it
            if (previewCollectedIndex !== preview.length) {
                collectUnmatched(preview.length, 0);
            }

            return result;
        }
    }
}
