export class TaskRouteError extends Error {
    public constructor(name: string, message?: string) {
        super(message);
        Object.setPrototypeOf(this, TaskRouteError.prototype);
        this.name = name;
    }
}