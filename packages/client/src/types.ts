import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { AnyRouter, IncomingMessage, OutgoingMessage } from "@zocket/core";

type UnsubscribeFn = () => void;

export type ClientOn<TRouter extends AnyRouter> = {
  [K in keyof TRouter]: TRouter[K] extends {
    _direction: "out";
    payload: infer TPayload;
  }
    ? TPayload extends StandardSchemaV1
      ? (
          callback: (payload: StandardSchemaV1.InferOutput<TPayload>) => void
        ) => UnsubscribeFn
      : never
    : TRouter[K] extends AnyRouter
    ? ClientOn<TRouter[K]>
    : never;
};

export type ClientUnified<TRouter extends AnyRouter> = {
  [K in keyof TRouter]: TRouter[K] extends {
    _direction: "in";
    payload: infer TPayload;
  }
    ? TPayload extends StandardSchemaV1
      ? TRouter[K] extends { _output?: infer TOutput }
        ? TOutput extends void
          ? (payload: StandardSchemaV1.InferInput<TPayload>) => void
          : (payload: StandardSchemaV1.InferInput<TPayload>) => Promise<TOutput>
        : (payload: StandardSchemaV1.InferInput<TPayload>) => void
      : never
    : TRouter[K] extends AnyRouter
    ? ClientUnified<TRouter[K]>
    : never;
};

export type ZocketClient<TRouter extends AnyRouter> = ClientUnified<TRouter> & {
  on: ClientOn<TRouter>;
  onOpen: (callback: () => void) => () => void;
  onClose: (callback: () => void) => () => void;
  onError: (callback: (error: unknown) => void) => () => void;
  close: () => void;
  reconnect: () => void;
  readonly readyState: number;
  readonly lastError: unknown | null;
};
