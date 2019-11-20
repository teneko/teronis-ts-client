import { FnParamAt, FnParamsWithResultFunction, ParamWithPromiseResultFunction, ParamWithResultFunction, PromiseResolveType, PromiseResolveTypeFromReturnType, RestArrayFunction, RestArrayWithAnyPromiseResultFunction, RestArrayWithPromiseResultFunction, RestArrayWithResultFunction } from "@teronis/ts-definitions";
import { CustomerPromiseError } from "./CustomerPromiseError";
import { ICustomerPromiseResolveResult } from "./projectTypes";

export function isCustomPromiseError<T>(error: Error): error is CustomerPromiseError<T> {
    const typedError = (error as CustomerPromiseError<T>);

    return typedError instanceof Error &&
        typedError.error instanceof Error &&
        typeof typedError.recall === "function";
}

export type ParamTypeWithAnyPromiseResultFunction<ParamType> = ParamWithResultFunction<ParamType, Promise<any>>;
export type AnyParamsWithPromiseResultFunction<TPromiseResolve> = ParamWithResultFunction<any[], Promise<TPromiseResolve>>;

export class Connector<
    PrevFn extends RestArrayWithAnyPromiseResultFunction,
    NextFn extends ParamTypeWithAnyPromiseResultFunction<PromiseResolveTypeFromReturnType<PrevFn>> = ParamTypeWithAnyPromiseResultFunction<PromiseResolveTypeFromReturnType<PrevFn>>,
    _ReturnTypeFromNextFn extends ReturnType<NextFn> = ReturnType<NextFn>,
    _PromiseResolveTypeFromReturnTypeFromNextFn = PromiseResolveType<_ReturnTypeFromNextFn>,
    _PassThrough extends FnParamsWithResultFunction<PrevFn, Promise<PromiseResolveType<_ReturnTypeFromNextFn>>> = FnParamsWithResultFunction<PrevFn, Promise<PromiseResolveType<_ReturnTypeFromNextFn>>>,
    _PassThroughWrapper extends FnParamsWithResultFunction<PrevFn, Promise<ICustomerPromiseResolveResult<PromiseResolveType<_ReturnTypeFromNextFn>>>> = FnParamsWithResultFunction<PrevFn, Promise<ICustomerPromiseResolveResult<PromiseResolveType<_ReturnTypeFromNextFn>>>>
    > {
    private static wrapWithConnectorFactory<Fn extends RestArrayWithAnyPromiseResultFunction>(fn: Fn) {
        const connectorFactory = createConnectorFactory(fn);
        const reverseConnectorFactory = createReverseConnectorFactory(fn);

        const wrappedFn = fn as Fn & { connectorFactory: typeof connectorFactory, reverseConnectorFactory: typeof reverseConnectorFactory };
        /**
         * That is the connector factory that needs a nextFn to create a Connector.
         */
        wrappedFn.connectorFactory = connectorFactory;
        /** * That is the connector factory that needs a prevFn to create a Connector. */
        wrappedFn.reverseConnectorFactory = reverseConnectorFactory;
        return wrappedFn;
    }

    private static wrapWithConnectorFactoryAndFnReplacer<Fn extends RestArrayWithAnyPromiseResultFunction>(fn: Fn, replace: (fn: Fn) => void) {
        const connectorFactoryWrappedFn = this.wrapWithConnectorFactory(fn);
        const wrappedFn = connectorFactoryWrappedFn as typeof connectorFactoryWrappedFn & { replace: typeof replace };
        /** This function replaces the contextual function with the passed function. */
        wrappedFn.replace = replace;
        return wrappedFn;
    }

    private _prevFn: PrevFn;
    private _nextFn: NextFn;

    public constructor(prevFn: PrevFn, nextFn: NextFn) {
        this._prevFn = prevFn;
        this._nextFn = nextFn;
    }

    public get prevFn() {
        return Connector.wrapWithConnectorFactoryAndFnReplacer(this._prevFn, (prevFn: PrevFn) => this._prevFn = prevFn);
    }

    public get nextFn() {
        return Connector.wrapWithConnectorFactoryAndFnReplacer(this._nextFn, (nextFn: NextFn) => this._nextFn = nextFn);
    }

    public passThrough = Connector.wrapWithConnectorFactory((async (...args: Parameters<PrevFn>) => {
        const prevFnResult = await this._prevFn(...args);
        const nextFnResult = await this._nextFn(prevFnResult);
        return nextFnResult as ReturnType<NextFn>;
    }) as _PassThrough);

    public get connectorFactory() {
        return this.passThrough.connectorFactory;
    }

    public get reverseConnectorFactory() {
        return this.passThrough.reverseConnectorFactory;
    }

    public passThroughWrapped = ((...args: Parameters<PrevFn>) => {
        const recall = () => {
            return this.passThroughWrapped(...args);
        };

        return this.passThrough(...args)
            .then((result) => ({
                result,
                recall,
            } as ICustomerPromiseResolveResult<_PromiseResolveTypeFromReturnTypeFromNextFn>))
            .catch((error) => {
                throw new CustomerPromiseError<_PromiseResolveTypeFromReturnTypeFromNextFn>(error, recall);
            });
    }) as _PassThroughWrapper;

    public getRetriableCustomerPromise = (retry: (error: CustomerPromiseError<_PromiseResolveTypeFromReturnTypeFromNextFn>) => Promise<ICustomerPromiseResolveResult<_PromiseResolveTypeFromReturnTypeFromNextFn>>, ...args: Parameters<PrevFn>) => {
        return this.passThroughWrapped(...args)
            .catch((error) => retry(error));
    }
}

function promisifyFn(fn: RestArrayFunction) {
    // No need to type the parameters.
    return (...args: any[]) => Promise.resolve(fn(...args));
}

/**
 * Pass prevFn to create a connector factory. The function prevFn must return a promise. You can call (nextFn) or promisify(nextFn) on the connector factory.
 */
export function createConnectorFactory<
    PrevFn extends RestArrayWithAnyPromiseResultFunction,
    >(prevFn: PrevFn) {
    /**
     * Pass nextFn to create a connector. The function nextFn must return a promise.
     */
    const createConnector = <
        NextFn extends ParamTypeWithAnyPromiseResultFunction<PromiseResolveTypeFromReturnType<PrevFn>>
    >(nextFn: NextFn) => new Connector(prevFn, nextFn);

    /**
     * Pass nextFn to create a connector. The function nextFn will be transformed to (args) => Promise.resolve(nextFn(args)).
     */
    createConnector.promisify = <
        NextFn extends ParamTypeWithAnyResultFunction<PromiseResolveTypeFromReturnType<PrevFn>>,
        _PromisifiedNextFn extends ParamWithPromiseResultFunction<PromiseResolveTypeFromReturnType<PrevFn>, ReturnType<NextFn>>
    >(nextFn: NextFn) => {
        const promisifiedNextFn = promisifyFn(nextFn) as _PromisifiedNextFn;
        return new Connector(prevFn, promisifiedNextFn);
    };

    return createConnector;
}

export type ParamTypeWithAnyResultFunction<ParamType> = ParamWithResultFunction<ParamType, any>;

/**
 * Pass prevFn to create a connector factory. The function prevFn will be transformed to (args) => Promise.resolve(prevFn(args)). You can call (nextFn) or promisify(nextFn) on the connector factory.
 */
createConnectorFactory.promisify = <
    PrevFn extends RestArrayFunction,
    _PromisifiedNextFn extends FnParamsWithResultFunction<PrevFn, Promise<ReturnType<PrevFn>>>
>(prevFn: PrevFn) => {
    const promisifiedPrevFn = promisifyFn(prevFn) as _PromisifiedNextFn;
    return createConnectorFactory(promisifiedPrevFn);
};

/**
 * Pass nextFn to create a reverse connector factory. The function nextFn must return a promise. You can call (prevFn) or promisify(prevFn) on the reverse connector factory.
 */
export function createReverseConnectorFactory<
    NextFn extends RestArrayWithAnyPromiseResultFunction,
    >(nextFn: NextFn) {
    /**
     * Pass prevFn to create a connector. The function prevFn must return a promise.
     */
    const createConnector = <
        PrevFn extends RestArrayWithPromiseResultFunction<FnParamAt<NextFn, 0>>
    >(prevFn: PrevFn) => new Connector(prevFn, nextFn);

    /**
     * Pass prevFn to create a connector. The function prevFn will be transformed to (args) => Promise.resolve(prevFn(args)).
     */
    createConnector.promisify = <
        PrevFn extends RestArrayWithResultFunction<FnParamAt<NextFn, 0>>,
        _PromisifiedPrevFn extends FnParamsWithResultFunction<PrevFn, Promise<ReturnType<PrevFn>>>
    >(prevFn: PrevFn) => {
        const promisifiedPrevFn = promisifyFn(prevFn) as _PromisifiedPrevFn;
        return new Connector(promisifiedPrevFn, nextFn);
    };

    return createConnector;
}
