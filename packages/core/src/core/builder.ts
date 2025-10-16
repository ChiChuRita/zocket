import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  MessageDef,
  MiddlewareFn,
  IncomingMessage,
  OutgoingMessage,
} from "./types";

export class MessageBuilder<TContext> {
  private readonly middlewares: ReadonlyArray<MiddlewareFn<any, any, any>>;

  constructor(middlewares: ReadonlyArray<MiddlewareFn<any, any, any>> = []) {
    this.middlewares = middlewares;
  }

  use<TAddedContext>(
    middleware: MiddlewareFn<TContext, any, TAddedContext>
  ): MessageBuilder<TContext & TAddedContext> {
    return new MessageBuilder<TContext & TAddedContext>([
      ...this.middlewares,
      middleware,
    ]);
  }

  incoming<TPayload extends StandardSchemaV1>({
    payload,
  }: {
    payload: TPayload;
  }): IncomingMessage<{ payload: TPayload }, TContext> {
    return {
      _direction: "in",
      payload,
      _middlewares: this.middlewares,
    } as IncomingMessage<{ payload: TPayload }, TContext>;
  }

  outgoing<TPayload extends StandardSchemaV1>({
    payload,
  }: {
    payload: TPayload;
  }): OutgoingMessage<{ payload: TPayload }> {
    return {
      _direction: "out",
      payload,
    } as OutgoingMessage<{ payload: TPayload }>;
  }
}
