import { RestArrayToPromiseFn, PromiseResultFromFn, ParamToPromiseResultFn, FunctionResultUnion, RestArrayFn } from "@teronis/ts-definitions";
import { ExtendableError } from "@teronis/ts-core";

export interface CustomerPromiseResolveResult<ResolveResult> {
    recall: () => Promise<CustomerPromiseResolveResult<ResolveResult>>,
    result: ResolveResult
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
    PrevFunction extends RestArrayToPromiseFn,
    NextFunction extends ParamToPromiseResultFn<PromiseResultFromFn<PrevFunction>, PromiseResultFromFn<NextFunction>>,
    CustomerPromiseFunction extends FunctionResultUnion<PrevFunction, Promise<CustomerPromiseResolveResult<PromiseResultFromFn<NextFunction>>>> = FunctionResultUnion<PrevFunction, Promise<CustomerPromiseResolveResult<PromiseResultFromFn<NextFunction>>>>
    > {
    private prevFn: PrevFunction;
    private nextFn: NextFunction;

    public constructor(prevFn: PrevFunction, nextFn: NextFunction) {
        this.prevFn = prevFn;
        this.nextFn = nextFn;
        this.getStubPromise = this.getStubPromise.bind(this);
    }

    public replacePrevFn(prevFn: PrevFunction) {
        this.prevFn = prevFn;
    }

    public replaceNextFn(nextFn: NextFunction) {
        this.nextFn = nextFn;
    }

    public getStubPromise(...args: Parameters<PrevFunction>) {
        return this.prevFn(...args).then((result) => {
            console.log("prev result", result);
            const nextPromise = this.nextFn(result);
            return nextPromise;
        }).then(result => {
            console.log("next result", result);
            return result;
        });
    }

    public getCustomerPromise = <CustomerPromiseFunction>((...args: Parameters<PrevFunction>) => {
        const recall = () => {
            return this.getCustomerPromise(...args);
        };

        return this.getStubPromise(...args)
            .then((result) => ({
                result,
                recall,
            } as CustomerPromiseResolveResult<PromiseResultFromFn<NextFunction>>))
            .catch((error) => {
                throw new CustomerPromiseError<PromiseResultFromFn<NextFunction>>(error, recall);
            });
    });

    public getRetriableCustomerPromise(retry: (error: CustomerPromiseError<PromiseResultFromFn<NextFunction>>) => Promise<CustomerPromiseResolveResult<PromiseResultFromFn<NextFunction>>>, ...args: Parameters<PrevFunction>) {
        return this.getCustomerPromise(...args)
            .catch((error) => retry(error));
    }
}

export type CustomerPromiseFunctionResultFromPromiseFunction<F extends RestArrayToPromiseFn> = Promise<CustomerPromiseResolveResult<PromiseResultFromFn<F>>>;

export type CustomerPromiseFunctionResultFromConnectorPromiseFunction<F extends (...args: any[]) => Promise<CustomerPromiseResolveResult<any>>> = F extends (...args: any[]) => Promise<CustomerPromiseResolveResult<infer T>> ? Promise<CustomerPromiseResolveResult<T>> : never;