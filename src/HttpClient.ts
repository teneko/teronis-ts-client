import { FnParamAt } from '@teronis/ts-definitions';
import { ReasonError } from "./ReasonError";
import { Connector, CustomerPromiseFunctionResultFromPromiseFunction, CustomerPromiseFunctionResultFromConnectorPromiseFunction } from "./Connector";
import { serialize } from "uri-js";
import { autoBind, getMethodNames } from "@teronis/ts-auto-bind-es6";

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

export type SomeHttpRequestOptions = HttpRequestOptions | HttpPostRequestOptions;

export function isHttpPostRequestOptions(options: HttpRequestOptions): options is HttpPostRequestOptions {
    return options.httpMethod === "POST";
}

export type RequestPromise = typeof HttpClient.requestPromise;

export type DeJsonResponsePromise = typeof HttpClient.deJsonResponsePromise;

export interface IDeJsonResponseConnectorPromise {
    (options: FnParamAt<RequestPromise, 0>): CustomerPromiseFunctionResultFromPromiseFunction<DeJsonResponsePromise>;
}

export class HttpClient {
    public static requestPromise(options: SomeHttpRequestOptions) {
        return new Promise<XMLHttpRequest>((resolve, reject) => {
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
    public static deJsonResponsePromise(request: XMLHttpRequest) {
        return Promise.resolve(JSON.parse(request.responseText));
    }

    public deJsonResponseConnector: Connector<RequestPromise, DeJsonResponsePromise, IDeJsonResponseConnectorPromise>;

    public constructor() {
        autoBind(this, getMethodNames(Object.create(HttpClient.prototype)));
        this.deJsonResponseConnector = new Connector(this.requestPromise, this.deJsonResponsePromise);
    }

    protected requestPromise(options: FnParamAt<RequestPromise, 0>) {
        return HttpClient.requestPromise(options);
    }

    protected deJsonResponsePromise(request: FnParamAt<DeJsonResponsePromise, 0>) {
        return HttpClient.deJsonResponsePromise(request);
    }
}