import { DeferredPromise } from "@teronis/ts-core";
import { ReasonError } from "./ReasonError";
import { getURIString, IURIComponents } from "./uri";
import { WebSocketError } from "./WebSocketError";

export interface IWebSocketRequestOptions {
    uri: string | IURIComponents;
    protocols?: string | string[];
    timeout?: number;
}

export interface IWebSocketStaticRequestOptions extends IWebSocketRequestOptions {
    /**
     * Has only effect, if default on-close handler is not redeclared.
     * The possible timeout rejection has precedence.
     */
    rejectOnDefaultClose?: true;
}

export interface IWebSocketStaticRequestPromiseResolveType {
    webSocket: WebSocket;
    openEvent: Event;
    /**
     * Represents the default on-close handler promise. If you redeclare the on-close
     * handler this promise gets senseless. However, if you call onCloseHandler, then
     * this promise gets definitely finished.
     */
    onClosePromise: Promise<CloseEvent>;
    /**
     * This represents the default on-close handler of the WebSocket.
     * This handler handles timeout rejection or resolves the CloseEvent when
     * the default onclose has been redeclared. Otherwise it will reject or
     * resolve depending on rejectOnDefaultCloseBut, if not already rejected
     * because of timeout.
     */
    onCloseHandler: (this: WebSocket, e: CloseEvent) => any;
}

export class WebSocketClient {
    public static CLOSE_CODE_TIMEOUT = 4000;
    public static ERROR_MESSAGE_DEFAULT = "WebSocketError";
    public static ERROR_MESSAGE_WEBSOCKET_SUPPORT = "NoSupportError";
    public static ERROR_MESSAGE_UNEXPECTED_CLOSE = "UnexpectedCloseError";
    public static ERROR_MESSAGE_TIMEOUT = "TimeoutError";

    public static createRequestAsync(options: IWebSocketStaticRequestOptions) {
        return new Promise<IWebSocketStaticRequestPromiseResolveType>((resolve, reject) => {
            if (!Object.prototype.hasOwnProperty.call(window, "WebSocket")) {
                reject(new ReasonError(WebSocketClient.ERROR_MESSAGE_WEBSOCKET_SUPPORT));
            } else {
                const { timeout = 0 } = options;
                const uri = getURIString(options.uri);
                const webSocket = new WebSocket(uri, options.protocols);
                const onCloseDeferredPromise = new DeferredPromise<CloseEvent>();

                // Double assignment for late check in possible timeout handler
                const onCloseHandler = (e: CloseEvent) => {
                    if (e.code === WebSocketClient.CLOSE_CODE_TIMEOUT) {
                        onCloseDeferredPromise.reject(new WebSocketError(WebSocketClient.ERROR_MESSAGE_TIMEOUT, e));
                    } else if (webSocket.onclose === onCloseHandler && options.rejectOnDefaultClose) {
                        onCloseDeferredPromise.reject(new WebSocketError(WebSocketClient.ERROR_MESSAGE_UNEXPECTED_CLOSE, e));
                    } else {
                        return onCloseDeferredPromise.resolve(e);
                    }
                };

                webSocket.onopen = (openEvent) => {
                    if (timeout) {
                        setTimeout(() => webSocket.close(WebSocketClient.CLOSE_CODE_TIMEOUT), timeout);
                    }

                    resolve({
                        webSocket,
                        openEvent,
                        onClosePromise: onCloseDeferredPromise.promise,
                        onCloseHandler,
                    });
                };

                webSocket.onclose = onCloseHandler;
                webSocket.onerror = (e) => { reject(new WebSocketError(WebSocketClient.ERROR_MESSAGE_DEFAULT, e)); };
            }
        });
    }
}
