/**
 * Use this component as a placeholder
 * when something is unfunctional because of an error
 */
import * as csx from "../../../node_modules/csx/csx";
import * as React from "react";
import * as pure from "../../common/pure";
import * as styles from "../styles/styles";

export class ErrorMessage extends React.Component<{text:string},{}>{
    shouldComponentUpdate = pure.shouldComponentUpdate;
    render(){
        let style = {
            padding: '20px',
            fontSize: '1.3rem',
            fontWeight: 'bold',
            color: styles.errorColor,
        };

        return <div style={csx.extend(csx.flex, csx.centerCenter, style)} >
            {this.props.text}
        </div>;
    }
}
