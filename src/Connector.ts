import { FnParamAt, FnParamsWithResultFunction, ParamWithPromiseResultFunction, ParamWithResultFunction, PromiseResolveType, PromiseResolveTypeFromReturnType, RestArrayFunction, RestArrayWithAnyPromiseResultFunction, RestArrayWithPromiseResultFunction, RestArrayWithResultFunction } from "@teronis/ts-definitions";

const createConnectorFnName = "createConnector";
const promisifyFnName = "promisifyFn";

/** This helper function create a promisification of the passed function. */
function promisifyFn<Fn extends RestArrayFunction>(fn: Fn) {
    // No need to type the parameters.
    return (...args: any[]) => Promise.resolve(fn(...args));
}

type FnReplacementParams<Fn extends RestArrayWithAnyPromiseResultFunction> = {
    getFnReplacment: (originalFnAsync: Fn) => Fn;
    getFnReplacmentPromisify: (originalFnAsync: Fn) => FnParamsWithResultFunction<Fn, PromiseResolveTypeFromReturnType<Fn>>;
};

type ParamTypeWithAnyResultFunction<ParamType> = ParamWithResultFunction<ParamType, any>;

export type ParamTypeWithAnyPromiseResultFunction<ParamType> = ParamWithResultFunction<ParamType, Promise<any>>;
export type AnyParamsWithPromiseResultFunction<TPromiseResolve> = ParamWithResultFunction<any[], Promise<TPromiseResolve>>;

export class Connector<
    PrevFnAsync extends RestArrayWithAnyPromiseResultFunction,
    NextFnAsync extends ParamTypeWithAnyPromiseResultFunction<PromiseResolveTypeFromReturnType<PrevFnAsync>> = ParamTypeWithAnyPromiseResultFunction<PromiseResolveTypeFromReturnType<PrevFnAsync>>,
    _ReturnTypeFromNextFn extends ReturnType<NextFnAsync> = ReturnType<NextFnAsync>,
    _PromiseResolveTypeFromReturnTypeFromNextFn = PromiseResolveType<_ReturnTypeFromNextFn>,
    _PassThroughAsync extends FnParamsWithResultFunction<PrevFnAsync, Promise<PromiseResolveType<_ReturnTypeFromNextFn>>> = FnParamsWithResultFunction<PrevFnAsync, Promise<PromiseResolveType<_ReturnTypeFromNextFn>>>,
    > {
    /** This factory function creates a connector with passed function you just passed. The necessary nextFn is created dynamically and will return the resolved result of prevFn. */
    public static createDummy<PrevFnAsync extends RestArrayWithAnyPromiseResultFunction>(prevFnAsync: PrevFnAsync) {
        const nextFnAsync = (result: PromiseResolveTypeFromReturnType<PrevFnAsync>) => Promise.resolve(result);
        return new Connector(prevFnAsync, nextFnAsync);
    }

    private static wrapWithConnectorFactory<FnAsync extends RestArrayWithAnyPromiseResultFunction>(fnAsync: FnAsync) {
        const connectorFactory = createConnectorFactory(fnAsync);
        const reverseConnectorFactory = createReverseConnectorFactory(fnAsync);

        return Object.assign(fnAsync, {
            /** This is a pre-created connector factory. */
            connectorFactory,
            /** This is a pre-created reverse connector factory. */
            reverseConnectorFactory,
        });
    }

    private _prevFnAsync: PrevFnAsync;
    private _nextFnAsync: NextFnAsync;

    public constructor(prevFnAsync: PrevFnAsync, nextFnAsync: NextFnAsync) {
        this._prevFnAsync = prevFnAsync;
        this._nextFnAsync = nextFnAsync;
    }

    private createReplaceContainer = <
        Fn extends RestArrayWithAnyPromiseResultFunction,
        >(fn: Fn, replaceFn: (fn: Fn) => void) => {
        const replaceFnAndReturnSelf = (replacement: Fn) => {
            replaceFn(replacement);
            return this as Connector<PrevFnAsync, NextFnAsync, _ReturnTypeFromNextFn, _PromiseResolveTypeFromReturnTypeFromNextFn, _PassThroughAsync>;
        };

        return {
            /** This function replaces the original function (prevFn or nextFn) with the the resulting function of the function that has been passed. */
            replaceFn: Object.assign((getFnReplacement: FnReplacementParams<Fn>["getFnReplacment"]) => {
                const replacement = getFnReplacement(fn);
                return replaceFnAndReturnSelf(replacement);
            }, {
                /** This function replaces the original function (prevFn or nextFn) with the the resulting, but promisified function of the function that has been passed. */
                [promisifyFnName]: (getFnReplacement: FnReplacementParams<Fn>["getFnReplacmentPromisify"]) => {
                    const nonPromiseFnReplacement = getFnReplacement(fn);
                    const promisifiedFnReplacement = promisifyFn(nonPromiseFnReplacement) as Fn;
                    return replaceFnAndReturnSelf(promisifiedFnReplacement);
                },
            }),
        };
    }

    private replacePrevFn = (prevFnReplacemnt: PrevFnAsync) => this._prevFnAsync = prevFnReplacemnt;

    public get prevFnAsync() {
        const prevFnAsync = this._prevFnAsync;
        const wrappedAsReplacable = Object.assign(prevFnAsync, this.createReplaceContainer(prevFnAsync, this.replacePrevFn));
        // const wrappedWithConnectorFactory = Connector.wrapWithConnectorFactory(prevFn);
        return prevFnAsync as typeof wrappedAsReplacable; // & typeof wrappedWithConnectorFactory);
    }

    private replaceNextFn = (nextFnReplacemnt: NextFnAsync) => this._nextFnAsync = nextFnReplacemnt;

    public get nextFnAsync() {
        const nextFnAsync = this._nextFnAsync;
        const wrappedAsReplacable = Object.assign(nextFnAsync, this.createReplaceContainer(nextFnAsync, this.replaceNextFn));
        // const wrappedWithConnectorFactory = Connector.wrapWithConnectorFactory(nextFn);
        return nextFnAsync as typeof wrappedAsReplacable; // & typeof wrappedWithConnectorFactory;
    }

    public passThroughAsync = (() => {
        // This one can be hot replaced.
        let replacablePassThroughAsync = (async (...args: Parameters<PrevFnAsync>) => {
            const prevFnResult = await this._prevFnAsync(...args);
            const nextFnResult = await this._nextFnAsync(prevFnResult);
            return nextFnResult as ReturnType<NextFnAsync>;
        }) as _PassThroughAsync;

        function replacePassThroughAsync(passThroughAsync: _PassThroughAsync) {
            replacablePassThroughAsync = passThroughAsync;
        }

        // This wrapper is calling the hot replacable function.
        const passThroughAsyncWrapper = ((...args: Parameters<PrevFnAsync>) => replacablePassThroughAsync(...args)) as _PassThroughAsync;
        const wrappedWithConnectorFactory = Connector.wrapWithConnectorFactory(passThroughAsyncWrapper);
        // We pass replacablePassThroughAsync, because it is the original function we want to pass.
        const wrappedAsReplacable = Object.assign(passThroughAsyncWrapper, this.createReplaceContainer(replacablePassThroughAsync, replacePassThroughAsync));
        return passThroughAsyncWrapper as typeof wrappedWithConnectorFactory & typeof wrappedAsReplacable;
    })();

    /** This is a pre-created connector factory. (See this.passThroughAsync.connectorFactory) */
    public get connectorFactory() {
        return this.passThroughAsync.connectorFactory;
    }

    /** This is a pre-created reverse connector factory. (See this.passThroughAsync.reverseConnectorFactory) */
    public get reverseConnectorFactory() {
        return this.passThroughAsync.reverseConnectorFactory;
    }
}

/**
 * Pass prevFn to create a connector factory. The function prevFn must return a promise.
 */
export const createConnectorFactory = Object.assign(<
    PrevFn extends RestArrayWithAnyPromiseResultFunction,
    >(prevFn: PrevFn) => {
    return {
        /** This factory function creates a connector with the function you passed before. The necessary nextFn is created dynamically and will return the resolved result of prevFn. */
        createDummyConnector: () => Connector.createDummy(prevFn),
        /** Pass nextFn to create a connector. The function nextFn must return a promise. */
        [createConnectorFnName]: Object.assign(<
            NextFn extends ParamTypeWithAnyPromiseResultFunction<PromiseResolveTypeFromReturnType<PrevFn>>
        >(nextFn: NextFn) => {
            return new Connector(prevFn, nextFn);
        },
            {
                /** Pass nextFn to create a connector. The function nextFn will be transformed to (args) => Promise.resolve(nextFn(args)). */
                [promisifyFnName]: <
                    NextFn extends ParamTypeWithAnyResultFunction<PromiseResolveTypeFromReturnType<PrevFn>>,
                    _PromisifiedNextFn extends ParamWithPromiseResultFunction<PromiseResolveTypeFromReturnType<PrevFn>, ReturnType<NextFn>>
                >(nextFn: NextFn) => {
                    const promisifiedNextFn = promisifyFn(nextFn) as _PromisifiedNextFn;
                    return new Connector(prevFn, promisifiedNextFn);
                },
            }),
    };
}, {
    /**
     * Pass prevFn to create a connector factory. The function prevFn will be transformed to (args) => Promise.resolve(prevFn(args)).
     */
    [promisifyFnName]: <
        PrevFn extends RestArrayFunction,
        _PromisifiedNextFn extends FnParamsWithResultFunction<PrevFn, Promise<ReturnType<PrevFn>>>
    >(prevFn: PrevFn) => {
        const promisifiedPrevFn = promisifyFn(prevFn) as _PromisifiedNextFn;
        return createConnectorFactory(promisifiedPrevFn);
    },
});

/**
 * Pass nextFn to create a reverse connector factory. The function nextFn must return a promise.
 */
export function createReverseConnectorFactory<
    NextFn extends RestArrayWithAnyPromiseResultFunction,
    >(nextFn: NextFn) {
    return {
        /** Pass prevFn to create a connector. The function prevFn will be transformed to (args) => Promise.resolve(prevFn(args)). */
        [createConnectorFnName]: Object.assign(<
            PrevFn extends RestArrayWithPromiseResultFunction<FnParamAt<NextFn, 0>>
        >(prevFn: PrevFn) => new Connector(prevFn, nextFn), {
            /** Pass prevFn to create a connector. The function prevFn must return a promise. */
            [promisifyFnName]: <
                PrevFn extends RestArrayWithResultFunction<FnParamAt<NextFn, 0>>,
                _PromisifiedPrevFn extends FnParamsWithResultFunction<PrevFn, Promise<ReturnType<PrevFn>>>
            >(prevFn: PrevFn) => {
                const promisifiedPrevFn = promisifyFn(prevFn) as _PromisifiedPrevFn;
                return new Connector(promisifiedPrevFn, nextFn);
            },
        }),
    };
}
