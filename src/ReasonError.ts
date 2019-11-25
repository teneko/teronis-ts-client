import { ExtendableError } from "@teronis/ts-core";

export class ReasonError extends ExtendableError {
    public reason: string;
    public messageOnly?: string;

    public constructor(reason: string, message?: string) {
        super("An error occured because of '" + reason + "'" + (typeof message === "undefined" ? "" : ": " + message));
        this.reason = reason;
        this.messageOnly = message;
    }
}

export function isReasonError(error: Error): error is ReasonError {
    const typedError = error as ReasonError;
    return typedError && typedError instanceof Error && typeof typedError.reason === "string";
}
