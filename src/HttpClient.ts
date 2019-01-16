import { FunctionParameterAt, PromiseFunctionGenericType } from '@teronis/ts-definitions';
import { ReasonError } from "./ReasonError";
import { Connector, CustomerPromiseFunctionResultFromPromiseFunction, CustomerPromiseFunctionResultFromConnectorPromiseFunction } from "./Connector";
import { serialize } from "uri-js";

export interface IURIComponents {
    scheme?: string;
    userinfo?: string;
    host?: string;
    port?: number | string;
    path?: string;
    query?: string;
    fragment?: string;
    reference?: string;
    error?: string;
}

export function isStringUri(uri: string | IURIComponents): uri is string {
    return typeof uri === "string";
}

export interface HttpRequestOptions {
    httpMethod: string;
    uri: string | IURIComponents;
    // In milliseconds.
    timeout?: number;
    beforeRequestTransmission?: (request: XMLHttpRequest) => void;
    // isDryRun: boolean
    logAfterTransmission?: boolean;
}

export interface HttpPostRequestOptions extends HttpRequestOptions {
    httpMethod: "POST";
    postData?: any;
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
    (options: FunctionParameterAt<IRequestPromise, 0>): CustomerPromiseFunctionResultFromPromiseFunction<IDeJsonResponseObjectPromise>;
}

export class HttpClient {
    public getDeJsonResponseObjectConnector: Connector<IRequestPromise, IDeJsonResponseObjectPromise, IDeJsonResponseObjectConnectorPromise>;

    public constructor() {
        this.getDeJsonResponseObjectConnector = new Connector(this.getRequestPromise, this.getDeJsonResponseObjectPromise);
    }

    public getRequestPromise(options: FunctionParameterAt<IRequestPromise, 0>) {
        return new Promise<PromiseFunctionGenericType<IRequestPromise>>((resolve, reject) => {
            const request = new XMLHttpRequest();
            const { timeout = 0 } = options;
            let uri: string;

            if (isStringUri(options.uri)) {
                uri = options.uri;
            } else {
                uri = serialize(options.uri);
            }

            request.open(options.httpMethod, uri, true);

            request.onload = () => {
                if (options.logAfterTransmission)
                    console.log("Page '" + uri + "' has been requested.", request);

                resolve(request);
            };

            request.onerror = () => { reject(new ReasonError("NetworkError")); };
            request.ontimeout = () => { reject(new ReasonError("TimeoutError")); };
            request.timeout = timeout; // after open and before send

            if (options.beforeRequestTransmission)
                options.beforeRequestTransmission(request);

            if (isHttpPostRequestOptions(options)) {
                request.send(options.postData);
            } else {
                request.send();
            }
        });
    }

    /**
     * 
     * @param request 
     * @throws {SyntaxError}
     */
    public getDeJsonResponseObjectPromise(request: FunctionParameterAt<IDeJsonResponseObjectPromise, 0>) {
        return Promise.resolve(JSON.parse(request.responseText));
    }
}