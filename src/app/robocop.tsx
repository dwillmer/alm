require('./robocop.css');

import {BaseComponent} from "./ui";

export interface Props {
}
export interface State {

}

export class Robocop extends BaseComponent<Props, State>{
    render(){
        return (
            <div className="progress">
              <div className="indeterminate"></div>
            </div>
        );
    }
}
