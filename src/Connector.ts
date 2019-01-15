import { RestArrayPromiseFunction, PromiseFunctionGenericType, T1TResultPromiseFunction, TResultFunction } from "@teronis/ts-definitions";

export interface CustomerPromiseResolveResult<TResolveResult> {
    getCustomerPromise: () => Promise<CustomerPromiseResolveResult<TResolveResult>>,
    result: TResolveResult
}

export interface CustomerPromiseRejectResult<TResolveResult> {
    getCustomerPromise: () => Promise<CustomerPromiseResolveResult<TResolveResult>>,
    error: Error
}

type CustomerPromiseFunctionResultFromConnectorResult<TResult> = Promise<CustomerPromiseResolveResult<TResult>>;

export type CustomerPromiseFunctionResultFromPromiseFunction<F extends RestArrayPromiseFunction> = Promise<CustomerPromiseResolveResult<PromiseFunctionGenericType<F>>>;

export class Connector<
    PrevFunction extends RestArrayPromiseFunction,
    NextFunction extends T1TResultPromiseFunction<PromiseFunctionGenericType<PrevFunction>, ConnectorResult>,
    CustomerPromiseFunction extends TResultFunction<PrevFunction, CustomerPromiseFunctionResultFromConnectorResult<ConnectorResult>> = TResultFunction<PrevFunction, CustomerPromiseFunctionResultFromConnectorResult<ConnectorResult>>,
    ConnectorParameters extends Parameters<PrevFunction> = Parameters<PrevFunction>,
    ConnectorResult extends PromiseFunctionGenericType<NextFunction> = PromiseFunctionGenericType<NextFunction>
    > {
    private _prevFn: PrevFunction;
    private _nextFn: NextFunction;

    public constructor(prevFn: PrevFunction, nextFn: NextFunction) {
        this._prevFn = prevFn;
        this._nextFn = nextFn;
    }

    public replacePrevFn(prevFn: PrevFunction) {
        this._prevFn = prevFn;
    }

    public replaceNextFn(nextFn: NextFunction) {
        this._nextFn = nextFn;
    }

    public getStubPromise(...args: ConnectorParameters) {
        return new Promise<ConnectorResult>((resolve) => {
            this._prevFn(...args)
                .then((result) => {
                    this._nextFn(result)
                        .then((result) => {
                            resolve(result);
                        });
                });
        });
    }

    public getCustomerPromise = <CustomerPromiseFunction>((...args: ConnectorParameters) => {
        return new Promise<CustomerPromiseResolveResult<ConnectorResult>>((resolve, reject) => {
            const getCustomerPromise = () => this.getCustomerPromise(...args);

            this.getStubPromise(...args)
                .then((result) => resolve({
                    getCustomerPromise: getCustomerPromise,
                    result
                }))
                .catch((error) => reject({
                    getCustomerPromise: getCustomerPromise,
                    error
                } as CustomerPromiseRejectResult<ConnectorResult>));
        });
    });
}