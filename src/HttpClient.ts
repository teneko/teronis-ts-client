import { autoBind, getMethodNames } from "@teronis/ts-auto-bind-es6";
import { FnParamAt } from "@teronis/ts-definitions";
import { Connector } from "./Connector";
import { ReasonError } from "./ReasonError";
import { getURIString, IURIComponents } from "./uri";

export interface IHttpNonPostRequestOptions {
    httpMethod: string;
    uri: string | IURIComponents;
    // In milliseconds.
    timeout?: number;
    beforeDispatch?: (request: XMLHttpRequest) => void;
    // isDryRun: boolean
    verbose?: boolean;
}

export interface IHttpPostRequestOptions extends IHttpNonPostRequestOptions {
    httpMethod: "POST";
    postData?: any;
}

export type HttpRequestOptions = IHttpNonPostRequestOptions | IHttpPostRequestOptions;

export function isHttpPostRequestOptions(options: IHttpNonPostRequestOptions): options is IHttpPostRequestOptions {
    return options.httpMethod === "POST";
}

export interface IRequestPromiseResolveType {
    options: HttpRequestOptions;
    request: XMLHttpRequest;
}

export type RequestPromise = typeof HttpClient.requestPromise;

export interface IDeJsonResponsePromiseResolveType extends IRequestPromiseResolveType {
    deJsonObject: any;
}

export type DeJsonResponsePromise = typeof HttpClient.deJsonResponsePromise;
export type DeJsonResponseConnectorPromise = typeof HttpClient.prototype.deJsonResponseConnector.getStubPromise;

export class HttpClient {
    public static ERROR_MESSAGE_NETWORK = "NetworkError";
    public static ERROR_MESSAGE_TIMEOUT = "TimeoutError";

    public static requestPromise(options: HttpRequestOptions) {
        const uri = getURIString(options.uri);

        const beVerbose = (result: any) => {
            if (options.verbose) {
                const isError = result instanceof Error;

                if (isError) {
                    console.error("An error occured while tried to reach " + uri + ":\r\n%o", {
                        options,
                        result,
                    });

                    throw result;
                } else {
                    console.log("The page " + uri + " answered\r\n%O", result);
                    return result;
                }
            }

            return result;
        };

        return new Promise<IRequestPromiseResolveType>((resolve, reject) => {
            const { timeout = 0 } = options;
            const request = new XMLHttpRequest();
            const container = { options, request };

            request.open(options.httpMethod, uri, true);
            request.onload = () => { resolve(container); };
            request.onerror = () => { reject(new ReasonError(HttpClient.ERROR_MESSAGE_NETWORK)); };
            request.ontimeout = () => { reject(new ReasonError(HttpClient.ERROR_MESSAGE_TIMEOUT)); };
            request.timeout = timeout; // after open and before send

            if (options.beforeDispatch) {
                options.beforeDispatch(request);
            }

            if (isHttpPostRequestOptions(options)) {
                request.send(options.postData);
            } else {
                request.send();
            }
        })
            .then(beVerbose)
            .catch(beVerbose);
    }

    /**
     *
     * @param request
     * @throws {SyntaxError}
     */
    public static deJsonResponsePromise(result: IRequestPromiseResolveType): Promise<IDeJsonResponsePromiseResolveType> {
        const deJsonObject = JSON.parse(result.request.responseText);

        if (result.options.verbose) {
            console.log("request response", deJsonObject);
        }

        return Promise.resolve({
            ...result,
            deJsonObject,
        });
    }

    // @ts-ignore: Intentionally unused
    /** We bind each function (not arrow) to this */
    private autoBind = autoBind(this, getMethodNames(Object.create(HttpClient.prototype)));

    public deJsonResponseConnector = new Connector(this.requestPromise, this.deJsonResponsePromise);

    protected requestPromise(options: FnParamAt<RequestPromise, 0>) {
        return HttpClient.requestPromise(options);
    }

    protected deJsonResponsePromise(request: FnParamAt<DeJsonResponsePromise, 0>) {
        return HttpClient.deJsonResponsePromise(request);
    }
}
