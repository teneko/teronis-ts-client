import { PromiseFunctionRestArray, GetPromiseFunctionGenericType, PromiseFunction1Return, PromiseFunctionRestArrayReturn } from "@teronis/ts-definitions";

export interface ConnectorResolvedPromiseFunction<PlainInvokeResultType> {
    getWrappedPromise: () => Promise<ConnectorResolvedPromiseFunction<PlainInvokeResultType>>,
    result: PlainInvokeResultType
};

export interface ConnectorRejectedPromiseFunction<PlainInvokeResultType> {
    getWrappedPromise: () => Promise<ConnectorResolvedPromiseFunction<PlainInvokeResultType>>,
    error: Error
};

export class Connector<PrevResultFunction extends PromiseFunctionRestArray,
    NextResultFunction extends PromiseFunction1Return<GetPromiseFunctionGenericType<PrevResultFunction>, GetPromiseFunctionGenericType<NextResultFunction>>> {
    private _prevFn: PrevResultFunction;
    private _nextFn: NextResultFunction;

    public constructor(prevFn: PrevResultFunction, nextFn: NextResultFunction) {
        this.getStubPromise = this.getStubPromise.bind(this);
        this._prevFn = prevFn;
        this._nextFn = nextFn;
    }

    public getStubPromise(...args: Parameters<PrevResultFunction>) {
        return new Promise<GetPromiseFunctionGenericType<NextResultFunction>>((resolve) => {
            this._prevFn(...args)
                .then((result) => {
                    this._nextFn(result)
                        .then((result) => {
                            resolve(result);
                        });
                });
        });
    }

    public getCustomerPromise(...args: Parameters<PrevResultFunction>) {
        return new Promise<ConnectorResolvedPromiseFunction<GetPromiseFunctionGenericType<NextResultFunction>>>((resolve, reject) => {
            const getWrappedPromise = () => this.getCustomerPromise(...args);

            this.getStubPromise(...args)
                .then((result) => resolve({
                    getWrappedPromise,
                    result
                }))
                .catch((error) => reject({
                    getWrappedPromise,
                    error
                } as ConnectorRejectedPromiseFunction<GetPromiseFunctionGenericType<NextResultFunction>>));
        });
    }
}