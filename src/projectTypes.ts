export interface ICustomerPromiseResolveResult<ResolveResult> {
    result: ResolveResult;
    recall: () => Promise<ICustomerPromiseResolveResult<ResolveResult>>;
}
