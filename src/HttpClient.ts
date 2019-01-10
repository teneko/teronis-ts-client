import { TaskRouteError } from "./TaskRouteError";
import { nameof } from "@teronis/ts-definitions";
import { Connector } from "./Connector";
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

export class HttpClient {
    public getDeJsonResponseObjectConnector: Connector<typeof HttpClient.getRequestPromise, typeof HttpClient.getDeJsonResponseObjectPromise>;

    public constructor() {
        this.getDeJsonResponseObjectConnector = new Connector(HttpClient.getRequestPromise, HttpClient.getDeJsonResponseObjectPromise);
    }

    public static getRequestPromise = function (options: HttpRequestOptions | HttpPostRequestOptions) {
        return new Promise<XMLHttpRequest>((resolve, reject) => {
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

            request.onerror = () => reject(new TaskRouteError("NetworkError"));
            request.ontimeout = () => reject(new TaskRouteError("TimeoutError"));
            // after open and before send
            request.timeout = timeout;

            if (options.beforeRequestTransmission)
                options.beforeRequestTransmission(request);

            if (nameof<HttpPostRequestOptions>("postData") in options) {
                request.send((options as HttpPostRequestOptions).postData);
            } else {
                request.send();
            }
        });
    }

    public static getDeJsonResponseObjectPromise(request: XMLHttpRequest) {
        return Promise.resolve(JSON.parse(request.responseText));
    }
}