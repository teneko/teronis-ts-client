import { autoBind, getMethodNames } from "@teronis/ts-auto-bind-es6";
import { createConnectorFactory } from "./Connector";
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

export interface IRequestResult {
    options: HttpRequestOptions;
    request: XMLHttpRequest;
}

export type CreateRequestPromiseFunction = typeof HttpClient.createRequestPromise;

export interface IDeserializedJsonResult extends IRequestResult {
    deserializedJsonObject: any;
}

export type DeserializeJsonResponseFunction = typeof HttpClient.deserializeJsonResponse;

export class HttpClient {
    public static ERROR_MESSAGE_NETWORK = "NetworkError";
    public static ERROR_MESSAGE_TIMEOUT = "TimeoutError";

    public static createRequestPromise(options: HttpRequestOptions): Promise<IRequestResult> {
        const uri = getURIString(options.uri);

        const beVerbose = <T>(result: T, isErrorenous: boolean) => {
            if (options.verbose) {
                if (isErrorenous) {
                    console.error("An error occured while tried to reach " + uri + ":\r\n%o", {
                        options,
                        result,
                    });
                } else {
                    console.log("The page " + uri + " answered\r\n%O", result);
                }
            }

            if (isErrorenous) {
                throw result;
            } else {
                return result;
            }
        };

        return new Promise<IRequestResult>((resolve, reject) => {
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
            .then((result) => beVerbose(result, false))
            .catch((result) => beVerbose(result, true));
    }

    /**
     * This function deserializes the result of the response and returns it.
     * @param result
     * @throws {SyntaxError}
     */
    public static deserializeJsonResponse(result: IRequestResult): IDeserializedJsonResult {
        const deJsonObject = JSON.parse(result.request.responseText);

        if (result.options.verbose) {
            console.log("request response", deJsonObject);
        }

        return {
            ...result,
            deserializedJsonObject: deJsonObject,
        };
    }

    // @ts-ignore: Intentionally unused
    /** We bind each function (not arrow) to this */
    private autoBind = autoBind(this, getMethodNames(Object.create(HttpClient.prototype)));
    public deserializeJsonRequestResultConnector = createConnectorFactory(HttpClient.createRequestPromise).createConnector.promisifyFn(HttpClient.deserializeJsonResponse);
}
