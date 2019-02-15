import { ExtendableError } from "@teronis/ts-core";
import { ICustomerPromiseResolveResult } from "./projectTypes";

export class CustomerPromiseError<
    ResolveResult,
    _CustomerPromiseFunction = () => Promise<ICustomerPromiseResolveResult<ResolveResult>>
    > extends ExtendableError {
    public error: Error;
    public recall: _CustomerPromiseFunction;

    public constructor(error: Error, recall: _CustomerPromiseFunction) {
        super(error);
        this.error = error;
        this.recall = recall;
    }
}
