import { serialize } from "uri-js";

export interface IURIComponents {
    scheme?: string;
    userinfo?: string;
    host?: string;
    port?: number | string;
    path?: string;
    query?: string;
    fragment?: string;
    reference?: string;
    error?: string;
}

export function isURIString(uri: string | IURIComponents): uri is string {
    return typeof uri === "string";
}

export function getURIString(uri: string | IURIComponents): string {
    if (isURIString(uri)) {
        return uri;
    } else {
        return serialize(uri);
    }
}
