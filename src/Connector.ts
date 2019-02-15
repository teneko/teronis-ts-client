import { ExtendableError } from "@teronis/ts-core";
import { FunctionResultUnion, ParamTypeToReturnTypeFn, PromiseResolveType, PromiseResolveTypeFromFn, PromiseResolveTypeOrType, PromisifyFn, RestArrayFn, RestArrayToPromiseFn } from "@teronis/ts-definitions";
import { CustomerPromiseError } from "./CustomerPromiseError";
import { ICustomerPromiseResolveResult } from "./projectTypes";

export function isCustomPromiseError<T>(error: Error): error is CustomerPromiseError<T> {
    const typedError = (error as CustomerPromiseError<T>);

    return typedError instanceof Error &&
        typedError.error instanceof Error &&
        typeof typedError.recall === "function";
}

export class Connector<
    PrevFn extends RestArrayFn,
    NextFn extends ParamTypeToReturnTypeFn<PromiseResolveTypeFromFn<PromisifyFn<PrevFn>>, ReturnType<NextFn>>,
    CustomerPromiseFn extends FunctionResultUnion<PrevFn, Promise<ICustomerPromiseResolveResult<PromiseResolveTypeOrType<ReturnType<NextFn>>>>> = FunctionResultUnion<PrevFn, Promise<ICustomerPromiseResolveResult<PromiseResolveTypeOrType<ReturnType<NextFn>>>>>,
    _PromisifiedPrevFn extends PromisifyFn<PrevFn> = PromisifyFn<PrevFn>,
    _PromisifiedReturnTypeFromNextFn extends PromiseResolveTypeOrType<ReturnType<NextFn>> = PromiseResolveTypeOrType<ReturnType<NextFn>>,
    _PromisifiedNextFn extends ParamTypeToReturnTypeFn<PromiseResolveTypeFromFn<PromisifyFn<PrevFn>>, _PromisifiedReturnTypeFromNextFn> = ParamTypeToReturnTypeFn<PromiseResolveTypeFromFn<PromisifyFn<PrevFn>>, _PromisifiedReturnTypeFromNextFn>
    > {
    private static promisifyFn(fn: RestArrayFn) {
        return (...args: any[]) => Promise.resolve(fn(...args));
    }

    private prevFn: _PromisifiedPrevFn;
    private nextFn: _PromisifiedNextFn;

    public constructor(prevFn: PrevFn, nextFn: NextFn) {
        this.prevFn = Connector.promisifyFn(prevFn) as _PromisifiedPrevFn;
        this.nextFn = Connector.promisifyFn(nextFn) as _PromisifiedNextFn;
    }

    public replacePrevFn(prevFn: PrevFn) {
        this.prevFn = Connector.promisifyFn(prevFn) as _PromisifiedPrevFn;
    }

    public replaceNextFn(nextFn: NextFn) {
        this.nextFn = Connector.promisifyFn(nextFn) as _PromisifiedNextFn;
    }

    public getStubPromise = (...args: Parameters<_PromisifiedPrevFn>) => {
        return this.prevFn(...args).then((result) => this.nextFn(result));
    }

    public getCustomerPromise = ((...args: Parameters<_PromisifiedPrevFn>) => {
        const recall = () => {
            return this.getCustomerPromise(...args);
        };

        return this.getStubPromise(...args)
            .then((result) => ({
                result,
                recall,
            } as ICustomerPromiseResolveResult<_PromisifiedReturnTypeFromNextFn>))
            .catch((error) => {
                throw new CustomerPromiseError<PromiseResolveTypeOrType<ReturnType<NextFn>>>(error, recall);
            });
    }) as CustomerPromiseFn;

    public getRetriableCustomerPromise = (retry: (error: CustomerPromiseError<_PromisifiedReturnTypeFromNextFn>) => Promise<ICustomerPromiseResolveResult<_PromisifiedReturnTypeFromNextFn>>, ...args: Parameters<_PromisifiedPrevFn>) => {
        return this.getCustomerPromise(...args)
            .catch((error) => retry(error));
    }
}
