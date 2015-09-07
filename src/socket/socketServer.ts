import * as sls from "../socketLib/socketLibServer";
import * as contract from "./socketContract";
import http = require("http");
import * as fsu from "../server/utils/fsu";
import * as fslw from "../server/workers/fileListing/fileListingMaster";

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
    
    export var getFileContents : typeof contract.server.getFileContents = (data) => {
        let contents = fsu.readFile(fsu.resolve(process.cwd(), data.filePath));
        return Promise.resolve({ contents });
    }
    
    export var getAllFiles : typeof contract.server.getAllFiles = (data) => {
        return fslw.worker.getFileList({ directory: process.cwd() });
    }
}

// Ensure that the namespace follows the contract
var _checkTypes: typeof contract.server = Server;

/** Will be available after register is called */
export var cast = contract.cast;

/** launch server */
export function register(app: http.Server) {
    let runResult = sls.run({
        app,
        serverImplementation: Server,
        clientContract:contract.client,
        cast:contract.cast
    });
    cast = runResult.cast;
    
    // For testing
    // setInterval(() => cast.hello.emit({ text: 'nice' }), 1000);
}
