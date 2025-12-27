import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { AnyRouter, IncomingMessage, OutgoingMessage } from "@zocket/core";

type UnsubscribeFn = () => void;

export type ClientSend<TRouter extends AnyRouter> = {
  [K in keyof TRouter]: TRouter[K] extends IncomingMessage<infer TDef>
    ? (payload: StandardSchemaV1.InferInput<TDef["payload"]>) => void
    : TRouter[K] extends AnyRouter
    ? ClientSend<TRouter[K]>
    : never;
};

export type ClientOn<TRouter extends AnyRouter> = {
  [K in keyof TRouter]: TRouter[K] extends OutgoingMessage<infer TDef>
    ? (
        callback: (
          payload: StandardSchemaV1.InferOutput<TDef["payload"]>
        ) => void
      ) => UnsubscribeFn
    : TRouter[K] extends AnyRouter
    ? ClientOn<TRouter[K]>
    : never;
};

export type ZocketClient<TRouter extends AnyRouter> = {
  send: ClientSend<TRouter>;
  on: ClientOn<TRouter>;
  onOpen: (callback: () => void) => () => void;
  onClose: (callback: () => void) => () => void;
  onError: (callback: (error: unknown) => void) => () => void;
  close: () => void;
  reconnect: () => void;
  readonly readyState: number;
  readonly lastError: unknown | null;
};
