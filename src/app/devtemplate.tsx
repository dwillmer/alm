import React = require("react");
import {BaseComponent} from "./ui";
import * as ui from "./ui";


export interface Props extends React.Props<any> {

}
export interface State {

}

@ui.Radium
export class FindAndReplace extends BaseComponent<Props, State>{
    render(){
        return (
            <div>
            </div>
        );
    }
}
