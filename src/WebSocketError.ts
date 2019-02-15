import { ReasonError } from "./ReasonError";

export class WebSocketError extends ReasonError {
    public event: Event;

    public constructor(reason: string, event: Event) {
        super(reason);
        this.event = event;
    }
}
