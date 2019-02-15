import { ICustomerPromiseResolveResult } from "./projectTypes";

export type PromiseResolveTypeFromGetCustomerPromiseFn<F extends (...args: any[]) => Promise<ICustomerPromiseResolveResult<any>>> = F extends (...args: any[]) => Promise<ICustomerPromiseResolveResult<infer T>> ? ICustomerPromiseResolveResult<T> : never;
