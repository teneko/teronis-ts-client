import { FunctionParameterAt } from '@teronis/ts-definitions';
import { TaskRouteError } from "./TaskRouteError";
import { Connector, CustomerPromiseResolveResult } from "./Connector";
import { URIComponents } from "./URIComponents";
import { serialize } from "uri-js";

export interface HttpRequestOptions {
    httpMethod: string
    uri: string | URIComponents
    // In milliseconds.
    timeout?: number
    beforeRequestTransmission?: (request: XMLHttpRequest) => void
    // isDryRun: boolean
    logAfterTransmission?: boolean
}

export interface HttpPostRequestOptions extends HttpRequestOptions {
    httpMethod: "POST"
    postData?: any
}

export function isHttpPostRequestOptions(options: HttpRequestOptions): options is HttpPostRequestOptions {
    return options.httpMethod === "POST";
}

export interface IRequestPromise {
    (options: HttpRequestOptions | HttpPostRequestOptions): Promise<XMLHttpRequest>;
}

export interface IDeJsonResponseObjectPromise {
    (request: XMLHttpRequest): Promise<any>;
}

export interface IDeJsonResponseObjectConnectorPromise {
    (options: FunctionParameterAt<IRequestPromise, 0>): ReturnType<IDeJsonResponseObjectPromise>
}

export class HttpClient {
    public getDeJsonResponseObjectConnector: Connector<IRequestPromise, IDeJsonResponseObjectPromise, IDeJsonResponseObjectConnectorPromise>;

    public constructor() {
        this.getDeJsonResponseObjectConnector = new Connector(this.getRequestPromise, this.getDeJsonResponseObjectPromise);
    }

    public getRequestPromise = <IRequestPromise>((options) => {
        return new Promise((resolve, reject) => {
            const request = new XMLHttpRequest();
            const { timeout = 0 } = options;
            let uri: string;

            if (options.uri instanceof URIComponents) {
                uri = serialize(options.uri);
            } else {
                uri = options.uri;
            }

            request.open(options.httpMethod, uri, true);

            request.onload = () => {
                if (options.logAfterTransmission)
                    console.log("Page '" + uri + "' has been requested.", request);

                resolve(request);
            };

            request.onerror = () => { reject(new TaskRouteError("NetworkError")); };
            request.ontimeout = () => { reject(new TaskRouteError("TimeoutError")); };
            // after open and before send
            request.timeout = timeout;

            if (options.beforeRequestTransmission)
                options.beforeRequestTransmission(request);

            if (isHttpPostRequestOptions(options)) {
                request.send(options.postData);
            } else {
                request.send();
            }
        });
    });

    /**
     * 
     * @param request 
     * @throws {SyntaxError}
     */
    public getDeJsonResponseObjectPromise = <IDeJsonResponseObjectPromise>((request) => {
        return Promise.resolve(JSON.parse(request.responseText));
    });
}