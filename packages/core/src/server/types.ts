import type { AnyRouter } from "../core/types";
import type { Sender } from "./context";

export interface WebSocketAdapter {
  send(message: string): void;
  close(): void;
  subscribe(topic: string): void;
  unsubscribe(topic: string): void;
}

export interface RequestLike {
  headers: Map<string, string>;
  url: string;
}

export interface UpgradeResult {
  success: boolean;
  clientId?: string;
  headers?: Record<string, unknown>;
  error?: { status: number; body: string };
}

export interface ServerLike {
  port: number;
  stop(force?: boolean): void;
  publish?(topic: string, message: string): void;
}

export type ZocketServer<TRouter extends AnyRouter> = ServerLike & {
  send: Sender<TRouter>;
};

export interface ServerAdapter {
  start(options: {
    port?: number;
    hostname?: string;
    onUpgrade: (req: RequestLike) => UpgradeResult | Promise<UpgradeResult>;
    onOpen: (
      ws: WebSocketAdapter,
      clientId: string,
      headers: any
    ) => void | Promise<void>;
    onMessage: (
      ws: WebSocketAdapter,
      clientId: string,
      message: string
    ) => void | Promise<void>;
    onClose: (ws: WebSocketAdapter, clientId: string) => void | Promise<void>;
  }): ServerLike;
}
