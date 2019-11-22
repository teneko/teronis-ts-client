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

    private static wrapAsReplacable<Fn extends RestArrayWithAnyPromiseResultFunction, ReplaceFn extends (fn: Fn) => any>(fn: Fn, replace: ReplaceFn) {
        const wrappedFn = fn as Fn & { replace: typeof replace };

        /** This function replaces the contextual function with the passed function. */
        wrappedFn.replace = replace;

        return wrappedFn;
    }

    private static wrapAsRecallable<
        Fn extends RestArrayWithAnyPromiseResultFunction,
        _PromiseResolveTypeFromFn extends PromiseResolveTypeFromReturnType<Fn> = PromiseResolveTypeFromReturnType<Fn>,
        _AsRecallable extends FnParamsWithResultFunction<Fn, Promise<ICustomerPromiseResolveResult<_PromiseResolveTypeFromFn>>> = FnParamsWithResultFunction<Fn, Promise<ICustomerPromiseResolveResult<_PromiseResolveTypeFromFn>>>
    >(fn: Fn) {
        const asRecallable = ((...args: Parameters<Fn>) => {
            const recall = () => {
                return asRecallable(...args);
            };

            return fn(args)
                .then((result) => ({
                    result,
                    recall,
                } as ICustomerPromiseResolveResult<_PromiseResolveTypeFromFn>))
                .catch((error) => {
                    throw new CustomerPromiseError<_PromiseResolveTypeFromFn>(error, recall);
                });
        }) as _AsRecallable;

        const wrappedFn = fn as Fn & { asRecallable: _AsRecallable };
        /** This function replaces the contextual function with the function that has been passed. */
        wrappedFn.asRecallable = asRecallable;
        return wrappedFn;
    }

    // public static wrapAsRetriable<Fn extends RestArrayWithAnyPromiseResultFunction, ErrorType>(fn: Fn) {
    //     const asRetriable = (retry: (error: CustomerPromiseError<_PromiseResolveTypeFromReturnTypeFromNextFn>) => Promise<ICustomerPromiseResolveResult<_PromiseResolveTypeFromReturnTypeFromNextFn>>, ...args: Parameters<Fn>)=> {

    //     };
    // }

    private _prevFn: PrevFn;
    private _nextFn: NextFn;

    public constructor(prevFn: PrevFn, nextFn: NextFn) {
        this._prevFn = prevFn;
        this._nextFn = nextFn;
    }

    public get prevFn() {
        const prevFn = this._prevFn;
        const wrappedAsReplacable = Connector.wrapAsReplacable(prevFn, (fn: PrevFn) => this as Connector<PrevFn, NextFn, _ReturnTypeFromNextFn, _PromiseResolveTypeFromReturnTypeFromNextFn, _PassThrough, _PassThroughWrapper>);
        const wrappedWithConnectorFactory = Connector.wrapWithConnectorFactory(prevFn);
        return prevFn as typeof wrappedAsReplacable & typeof wrappedWithConnectorFactory;
    }

    public get nextFn() {
        const nextFn = this._nextFn;
        const wrappedAsReplacable = Connector.wrapAsReplacable(nextFn, (fn: NextFn) => this as Connector<PrevFn, NextFn, _ReturnTypeFromNextFn, _PromiseResolveTypeFromReturnTypeFromNextFn, _PassThrough, _PassThroughWrapper>);
        const wrappedWithConnectorFactory = Connector.wrapWithConnectorFactory(nextFn);
        return nextFn as typeof wrappedAsReplacable & typeof wrappedWithConnectorFactory;
    }

    public passThrough = (() => {
        const passThrough = (async (...args: Parameters<PrevFn>) => {
            const prevFnResult = await this._prevFn(...args);
            const nextFnResult = await this._nextFn(prevFnResult);
            return nextFnResult as ReturnType<NextFn>;
        }) as _PassThrough;

        const wrappedWithConnectorFactory = Connector.wrapWithConnectorFactory(passThrough);
        const wrappedWithFnRecaller = Connector.wrapAsRecallable(passThrough);
        return passThrough as typeof wrappedWithConnectorFactory & typeof wrappedWithFnRecaller;
    })();

    public get connectorFactory() {
        return this.passThrough.connectorFactory;
    }

    public get reverseConnectorFactory() {
        return this.passThrough.reverseConnectorFactory;
    }

    // public getRetriableCustomerPromise = (retry: (error: CustomerPromiseError<_PromiseResolveTypeFromReturnTypeFromNextFn>) => Promise<ICustomerPromiseResolveResult<_PromiseResolveTypeFromReturnTypeFromNextFn>>, ...args: Parameters<PrevFn>) => {
    //     return this.passThrough.asRecallable(...args)
    //         .catch((error) => retry(error));
    // }
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
