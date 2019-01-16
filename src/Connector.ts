import { RestArrayPromiseFunction, PromiseFunctionGenericType, T1TResultPromiseFunction, TResultFunction } from "@teronis/ts-definitions";
import { ExtendableError } from "@teronis/ts-core";

export interface CustomerPromiseResolveResult<TResolveResult> {
    recall: () => Promise<CustomerPromiseResolveResult<TResolveResult>>,
    result: TResolveResult
}

export class CustomerPromiseError<
    TResolveResult,
    CustomerPromiseFunction = () => Promise<CustomerPromiseResolveResult<TResolveResult>>
    > extends ExtendableError {
    public error: Error;
    public recall: CustomerPromiseFunction;

    public constructor(error: Error, recall: CustomerPromiseFunction) {
        super(error);
        this.error = error;
        this.recall = recall;
    }
}

export class Connector<
    PrevFunction extends RestArrayPromiseFunction,
    NextFunction extends T1TResultPromiseFunction<PromiseFunctionGenericType<PrevFunction>, PromiseFunctionGenericType<NextFunction>>,
    CustomerPromiseFunction extends TResultFunction<PrevFunction, Promise<CustomerPromiseResolveResult<PromiseFunctionGenericType<NextFunction>>>> = TResultFunction<PrevFunction, Promise<CustomerPromiseResolveResult<PromiseFunctionGenericType<NextFunction>>>>
    > {
    private _prevFn: PrevFunction;
    private _nextFn: NextFunction;

    public constructor(prevFn: PrevFunction, nextFn: NextFunction) {
        this._prevFn = prevFn;
        this._nextFn = nextFn;
        this.getStubPromise = this.getStubPromise.bind(this);
    }

    public replacePrevFn(prevFn: PrevFunction) {
        this._prevFn = prevFn;
    }

    public replaceNextFn(nextFn: NextFunction) {
        this._nextFn = nextFn;
    }

    public getStubPromise(...args: Parameters<PrevFunction>) {
        return this._prevFn(...args).then((result) => this._nextFn(result));
    }

    public getCustomerPromise = <CustomerPromiseFunction>((...args: Parameters<PrevFunction>) => {
        const recall = () => {
            return this.getCustomerPromise(...args);
        };

        return this.getStubPromise(...args)
            .then((result) => ({
                result,
                recall,
            } as CustomerPromiseResolveResult<PromiseFunctionGenericType<NextFunction>>))
            .catch((error) => {
                throw new CustomerPromiseError<PromiseFunctionGenericType<NextFunction>>(error, recall);
            });
    });
}

export type CustomerPromiseFunctionResultFromPromiseFunction<F extends RestArrayPromiseFunction> = Promise<CustomerPromiseResolveResult<PromiseFunctionGenericType<F>>>;

export type CustomerPromiseFunctionResultFromConnectorPromiseFunction<F extends RestArrayPromiseFunction> = F extends (...args: any[]) => Promise<CustomerPromiseResolveResult<infer T>> ? Promise<CustomerPromiseResolveResult<T>> : never;