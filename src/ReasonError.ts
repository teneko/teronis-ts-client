import { ExtendableError } from "@teronis/ts-core";

export class ReasonError extends ExtendableError {
    public constructor(reason: string, message?: string) {
        super("An error occured because of '" + reason + "'" + (typeof message === "undefined" ? "" : ": " + message));
    }
}