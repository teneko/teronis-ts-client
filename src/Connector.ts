import { RestArrayToPromiseFn, PromiseResolveTypeFromFn, FunctionResultUnion, RestArrayFn, PromiseResolveType, ParamTypeToReturnTypeFn, PromisifyFn, PromiseResolveTypeOrType } from "@teronis/ts-definitions";
import { ExtendableError } from "@teronis/ts-core";

export interface CustomerPromiseResolveResult<ResolveResult> {
    result: ResolveResult
    recall: () => Promise<CustomerPromiseResolveResult<ResolveResult>>,
}

export class CustomerPromiseError<
    ResolveResult,
    CustomerPromiseFunction = () => Promise<CustomerPromiseResolveResult<ResolveResult>>
    > extends ExtendableError {
    public error: Error;
    public recall: CustomerPromiseFunction;

    public constructor(error: Error, recall: CustomerPromiseFunction) {
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
    PromisifiedPrevFn extends PromisifyFn<PrevFn> = PromisifyFn<PrevFn>,
    ReturnTypeFromFnAsPromise extends PromiseResolveTypeOrType<ReturnType<NextFn>> = PromiseResolveTypeOrType<ReturnType<NextFn>>,
    PromisifiedNextFn extends ParamTypeToReturnTypeFn<PromiseResolveTypeFromFn<PromisifyFn<PrevFn>>, ReturnTypeFromFnAsPromise> = ParamTypeToReturnTypeFn<PromiseResolveTypeFromFn<PromisifyFn<PrevFn>>, ReturnTypeFromFnAsPromise>
    > {
    private static promisifyFn(fn: Function) {
        return (...args: any[]) => Promise.resolve(fn(...args));
    }

    private prevFn: PromisifiedPrevFn;
    private nextFn: PromisifiedNextFn;

    public constructor(prevFn: PrevFn, nextFn: NextFn) {
        this.prevFn = <PromisifiedPrevFn>Connector.promisifyFn(prevFn);
        this.nextFn = <PromisifiedNextFn>Connector.promisifyFn(nextFn);
        this.getStubPromise = this.getStubPromise.bind(this);
    }

    public replacePrevFn(prevFn: PrevFn) {
        this.prevFn = <PromisifiedPrevFn>Connector.promisifyFn(prevFn);
    }

    public replaceNextFn(nextFn: NextFn) {
        this.nextFn = <PromisifiedNextFn>Connector.promisifyFn(nextFn);
    }

    public getStubPromise(...args: Parameters<PromisifiedPrevFn>) {
        return this.prevFn(...args).then((result) => this.nextFn(result));
    }

    public getCustomerPromise = <CustomerPromiseFn>((...args: Parameters<PromisifiedPrevFn>) => {
        const recall = () => {
            return this.getCustomerPromise(...args);
        };

        return this.getStubPromise(...args)
            .then((result) => ({
                result,
                recall,
            } as CustomerPromiseResolveResult<ReturnTypeFromFnAsPromise>))
            .catch((error) => {
                throw new CustomerPromiseError<ReturnTypeFromFnAsPromise>(error, recall);
            });
    });

    public getRetriableCustomerPromise = (retry: (error: CustomerPromiseError<ReturnTypeFromFnAsPromise>) => Promise<CustomerPromiseResolveResult<ReturnTypeFromFnAsPromise>>, ...args: Parameters<PromisifiedPrevFn>) => {
        return this.getCustomerPromise(...args)
            .catch((error) => retry(error));
    }
}

export type CustomerPromiseFunctionResultFromPromiseFunction<F extends RestArrayToPromiseFn> = Promise<CustomerPromiseResolveResult<PromiseResolveTypeFromFn<F>>>;

export type CustomerPromiseFunctionResultFromConnectorPromiseFunction<F extends (...args: any[]) => Promise<CustomerPromiseResolveResult<any>>> = F extends (...args: any[]) => Promise<CustomerPromiseResolveResult<infer T>> ? Promise<CustomerPromiseResolveResult<T>> : never;