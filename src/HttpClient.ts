import { FnParamAt } from '@teronis/ts-definitions';
import { ReasonError } from "./ReasonError";
import { Connector } from "./Connector";
import { autoBind, getMethodNames } from "@teronis/ts-auto-bind-es6";
import { IURIComponents, getURIString } from './uri';

export interface IHttpRequestOptions {
    httpMethod: string;
    uri: string | IURIComponents;
    // In milliseconds.
    timeout?: number;
    beforeRequestTransmission?: (request: XMLHttpRequest) => void;
    // isDryRun: boolean
    logAfterTransmission?: boolean;
}

export interface IHttpPostRequestOptions extends IHttpRequestOptions {
    httpMethod: "POST";
    postData?: any;
}

export type HttpRequestOptions = IHttpRequestOptions | IHttpPostRequestOptions;

export function isHttpPostRequestOptions(options: IHttpRequestOptions): options is IHttpPostRequestOptions {
    return options.httpMethod === "POST";
}

export type RequestPromise = typeof HttpClient.requestPromise;
export type DeJsonResponsePromise = typeof HttpClient.deJsonResponsePromise;
export type DeJsonResponseConnectorPromise = typeof HttpClient.prototype.deJsonResponseConnector.getStubPromise;

export class HttpClient {
    public static NetworkError = "NetworkError";
    public static TimeoutError = "TimeoutError";

    public static requestPromise(options: HttpRequestOptions) {
        return new Promise<XMLHttpRequest>((resolve, reject) => {
            const { timeout = 0 } = options;
            const request = new XMLHttpRequest();
            const uri = getURIString(options.uri);

            request.open(options.httpMethod, uri, true);

            request.onload = () => {
                if (options.logAfterTransmission)
                    console.log("Page '" + uri + "' has been requested.", request);

                resolve(request);
            };

            request.onerror = () => { reject(new ReasonError(HttpClient.NetworkError)); };
            request.ontimeout = () => { reject(new ReasonError(HttpClient.TimeoutError)); };
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
        return JSON.parse(request.responseText);
    }

    // @ts-ignore: Intentionally unused
    /** We bind each function (not arrow) to this */
    private autoBind = autoBind(this, getMethodNames(Object.create(HttpClient.prototype)));

    public deJsonResponseConnector = new Connector(this.requestPromise, this.deJsonResponsePromise);

    public constructor() { }

    protected requestPromise(options: FnParamAt<RequestPromise, 0>) {
        return HttpClient.requestPromise(options);
    }

    protected deJsonResponsePromise(request: FnParamAt<DeJsonResponsePromise, 0>) {
        return HttpClient.deJsonResponsePromise(request);
    }
}