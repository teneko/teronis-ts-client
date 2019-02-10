import { RestArrayToPromiseFn, PromiseResolveTypeFromFn, FunctionResultUnion, RestArrayFn, PromiseResolveType, ParamTypeToReturnTypeFn, PromisifyFn, PromiseResolveTypeOrType } from "@teronis/ts-definitions";
import { ExtendableError } from "@teronis/ts-core";

export interface CustomerPromiseResolveResult<ResolveResult> {
    result: ResolveResult
    recall: () => Promise<CustomerPromiseResolveResult<ResolveResult>>,
}

export class CustomerPromiseError<
    ResolveResult,
    _CustomerPromiseFunction = () => Promise<CustomerPromiseResolveResult<ResolveResult>>
    > extends ExtendableError {
    public error: Error;
    public recall: _CustomerPromiseFunction;

    public constructor(error: Error, recall: _CustomerPromiseFunction) {
        super(error);
        this.error = error;
        this.recall = recall;
    }
}

export function isCustomPromiseError<T>(error: Error): error is CustomerPromiseError<T> {
    const typedError = (<CustomerPromiseError<T>>error);

    return typedError instanceof Error &&
        typedError.error instanceof Error &&
        typeof typedError.recall === "function";
}

export class Connector<
    PrevFn extends RestArrayFn,
    NextFn extends ParamTypeToReturnTypeFn<PromiseResolveTypeFromFn<PromisifyFn<PrevFn>>, ReturnType<NextFn>>,
    CustomerPromiseFn extends FunctionResultUnion<PrevFn, Promise<CustomerPromiseResolveResult<PromiseResolveTypeOrType<ReturnType<NextFn>>>>> = FunctionResultUnion<PrevFn, Promise<CustomerPromiseResolveResult<PromiseResolveTypeOrType<ReturnType<NextFn>>>>>,
    _PromisifiedPrevFn extends PromisifyFn<PrevFn> = PromisifyFn<PrevFn>,
    _PromisifiedReturnTypeFromNextFn extends PromiseResolveTypeOrType<ReturnType<NextFn>> = PromiseResolveTypeOrType<ReturnType<NextFn>>,
    _PromisifiedNextFn extends ParamTypeToReturnTypeFn<PromiseResolveTypeFromFn<PromisifyFn<PrevFn>>, _PromisifiedReturnTypeFromNextFn> = ParamTypeToReturnTypeFn<PromiseResolveTypeFromFn<PromisifyFn<PrevFn>>, _PromisifiedReturnTypeFromNextFn>
    > {
    private static promisifyFn(fn: Function) {
        return (...args: any[]) => Promise.resolve(fn(...args));
    }

    private prevFn: _PromisifiedPrevFn;
    private nextFn: _PromisifiedNextFn;

    public constructor(prevFn: PrevFn, nextFn: NextFn) {
        this.prevFn = <_PromisifiedPrevFn>Connector.promisifyFn(prevFn);
        this.nextFn = <_PromisifiedNextFn>Connector.promisifyFn(nextFn);
    }

    public replacePrevFn(prevFn: PrevFn) {
        this.prevFn = <_PromisifiedPrevFn>Connector.promisifyFn(prevFn);
    }

    public replaceNextFn(nextFn: NextFn) {
        this.nextFn = <_PromisifiedNextFn>Connector.promisifyFn(nextFn);
    }

    public getStubPromise = (...args: Parameters<_PromisifiedPrevFn>) => {
        return this.prevFn(...args).then((result) => this.nextFn(result));
    }

    public getCustomerPromise = <CustomerPromiseFn>((...args: Parameters<_PromisifiedPrevFn>) => {
        const recall = () => {
            return this.getCustomerPromise(...args);
        };
 
        return this.getStubPromise(...args)
            .then((result) => ({
                result,
                recall,
            } as CustomerPromiseResolveResult<_PromisifiedReturnTypeFromNextFn>))
            .catch((error) => {
                throw new CustomerPromiseError<PromiseResolveTypeOrType<ReturnType<NextFn>>>(error, recall);
            });
    });

    public getRetriableCustomerPromise = (retry: (error: CustomerPromiseError<_PromisifiedReturnTypeFromNextFn>) => Promise<CustomerPromiseResolveResult<_PromisifiedReturnTypeFromNextFn>>, ...args: Parameters<_PromisifiedPrevFn>) => {
        return this.getCustomerPromise(...args)
            .catch((error) => retry(error));
    }
}

export type PromiseResolveTypeFromGetCustomerPromiseFn<F extends (...args: any[]) => Promise<CustomerPromiseResolveResult<any>>> = F extends (...args: any[]) => Promise<CustomerPromiseResolveResult<infer T>> ? CustomerPromiseResolveResult<T> : never;