import type {
  AppDef,
  ClientApi,
  RpcCallMessage,
  RpcResultMessage,
  ServerMessage,
  EventMessage,
  StateSnapshotMessage,
  StatePatchMessage,
  WelcomeMessage,
} from "@zocket/core/types";
import { parseMessage, MSG } from "@zocket/core/protocol";
import { ActorHandleImpl } from "./actor-handle";

// ---------------------------------------------------------------------------
// Client options
// ---------------------------------------------------------------------------

export interface ClientOptions {
  /** WebSocket URL for the Zocket server (e.g., "ws://localhost:3000"). */
  url: string;
  /**
   * Total timeout in ms for an RPC, including time spent waiting for a live
   * socket before the request can be sent. 0 = no timeout. Default: 10000.
   */
  rpcTimeout?: number;
  /** Reject `$ready` if the initial connection is not established in time. */
  connectTimeout?: number;
  /** Automatically reconnect after unexpected socket closes. Default: true. */
  reconnect?: boolean;
  /** Override reconnect delay in ms. Useful for deterministic tests. */
  reconnectDelayMs?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface PendingRpc {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: Error): void;
  settled: boolean;
}

function createDeferred<T>(): Deferred<T> {
  let resolveFn!: (value: T) => void;
  let rejectFn!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });
  // Deferreds are internally rejected during reconnect / shutdown cycles.
  // Attach a no-op handler so these internal transitions do not surface as
  // unhandled rejections when nobody is currently awaiting them.
  void promise.catch(() => {});
  const deferred: Deferred<T> = {
    promise,
    resolve(value: T) {
      if (deferred.settled) return;
      deferred.settled = true;
      resolveFn(value);
    },
    reject(error: Error) {
      if (deferred.settled) return;
      deferred.settled = true;
      rejectFn(error);
    },
    settled: false,
  };
  return deferred;
}

function normalizeDisconnectError(reason?: string): Error {
  return new Error(reason ?? "WebSocket closed");
}

// ---------------------------------------------------------------------------
// Connection status
// ---------------------------------------------------------------------------

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

export type ClientEvent = "status";
export type ClientEventCallback<E extends ClientEvent> =
  E extends "status" ? (status: ConnectionStatus) => void : never;

type Unsubscribe = () => void;

export interface ClientConnection {
  readonly ready: Promise<void>;
  readonly status: ConnectionStatus;
  /** Server-assigned client id for this connection. `null` until the server's welcome arrives. */
  readonly clientId: string | null;
  subscribe(cb: (status: ConnectionStatus) => void): Unsubscribe;
  close(): void;
}

// ---------------------------------------------------------------------------
// createClient
// ---------------------------------------------------------------------------

export function createClient<TApp extends AppDef<any>>(
  options: ClientOptions,
): ClientApi<TApp> & {
  connection: ClientConnection;
  clientId: string | null;
  $close(): void;
  $ready: Promise<void>;
  $status: ConnectionStatus;
  on<E extends ClientEvent>(event: E, cb: ClientEventCallback<E>): Unsubscribe;
} {
  const wsUrl = options.url;
  const rpcTimeout = options.rpcTimeout ?? 10_000;
  const connectTimeout = options.connectTimeout ?? 10_000;
  const shouldReconnect = options.reconnect ?? true;
  const reconnectDelayMs = options.reconnectDelayMs;

  let ws: WebSocket | null = null;
  let connected = false;
  let wasClosedByUser = false;
  let hasOpenedOnce = false;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let connectionEpoch = 0;
  let currentOpenWait = createDeferred<void>();

  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  let readySettled = false;
  const readyPromise = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  const handles = new Map<string, ActorHandleImpl>();
  const disposeTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const pendingRpcs = new Map<string, PendingRpc>();

  // -- Connection status -----------------------------------------------------
  let currentStatus: ConnectionStatus = "connecting";
  let currentClientId: string | null = null;
  const statusListeners = new Set<(status: ConnectionStatus) => void>();

  function setStatus(next: ConnectionStatus): void {
    if (next === currentStatus) return;
    currentStatus = next;
    for (const cb of statusListeners) cb(next);
  }

  const settleReady = {
    resolve() {
      if (readySettled) return;
      readySettled = true;
      if (readyTimeout) clearTimeout(readyTimeout);
      resolveReady();
    },
    reject(error: Error) {
      if (readySettled) return;
      readySettled = true;
      if (readyTimeout) clearTimeout(readyTimeout);
      rejectReady(error);
    },
  };

  const readyTimeout =
    connectTimeout > 0
      ? setTimeout(() => {
          settleReady.reject(
            new Error(`WebSocket did not connect within ${connectTimeout}ms`),
          );
        }, connectTimeout)
      : null;

  function createReconnectDelay(attempt: number): number {
    if (reconnectDelayMs !== undefined) return reconnectDelayMs;
    const base = Math.min(250 * 2 ** Math.max(0, attempt - 1), 2_000);
    const jitter = Math.floor(Math.random() * 100);
    return base + jitter;
  }

  function clearReconnectTimer(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function wsSend(raw: string): void {
    if (!connected || !ws) return;
    try {
      ws.send(raw);
    } catch {
      // Ignore transient send failures; close handling will reconcile state.
    }
  }

  function syncActiveSubscriptions(): void {
    for (const handle of handles.values()) {
      handle.syncSubscriptions(wsSend);
    }
  }

  function rejectAllPendingRpcs(reason?: string): void {
    const error = normalizeDisconnectError(reason);
    for (const entry of pendingRpcs.values()) {
      if (entry.timer) clearTimeout(entry.timer);
      entry.reject(error);
    }
    pendingRpcs.clear();
  }

  async function waitForOpen(timeoutMs: number): Promise<void> {
    if (connected && ws) return;
    if (wasClosedByUser) {
      throw new Error("WebSocket client is closed");
    }

    if (timeoutMs <= 0) {
      await currentOpenWait.promise;
      return;
    }

    await Promise.race([
      currentOpenWait.promise,
      new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          clearTimeout(timer);
          reject(new Error(`WebSocket was not ready within ${timeoutMs}ms`));
        }, timeoutMs);
        currentOpenWait.promise.finally(() => clearTimeout(timer)).catch(() => {});
      }),
    ]);
  }

  function scheduleReconnect(): void {
    if (!shouldReconnect || wasClosedByUser || reconnectTimer) return;
    const delay = createReconnectDelay(++reconnectAttempt);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function handleSocketClosed(socket: WebSocket, reason?: string): void {
    if (socket !== ws) return;

    connected = false;
    currentClientId = null;
    ws = null;
    rejectAllPendingRpcs(reason);

    if (wasClosedByUser) {
      setStatus("disconnected");
      currentOpenWait.reject(normalizeDisconnectError(reason ?? "WebSocket client is closed"));
      settleReady.reject(new Error("WebSocket client closed before becoming ready"));
      return;
    }

    if (hasOpenedOnce) {
      currentOpenWait = createDeferred<void>();
      setStatus("reconnecting");
    }

    scheduleReconnect();
  }

  function connect(): void {
    if (wasClosedByUser) return;

    const socket = new WebSocket(wsUrl);
    const epoch = ++connectionEpoch;
    ws = socket;

    socket.onopen = () => {
      if (socket !== ws || epoch !== connectionEpoch) return;

      connected = true;
      reconnectAttempt = 0;
      clearReconnectTimer();
      hasOpenedOnce = true;
      setStatus("connected");
      currentOpenWait.resolve();
      settleReady.resolve();
      syncActiveSubscriptions();
    };

    socket.onmessage = (event: MessageEvent) => {
      if (socket !== ws || epoch !== connectionEpoch) return;

      const msg = parseMessage(
        typeof event.data === "string" ? event.data : event.data.toString(),
      ) as ServerMessage | null;
      if (!msg) return;

      switch (msg.type) {
        case MSG.WELCOME: {
          currentClientId = (msg as WelcomeMessage).clientId;
          break;
        }
        case MSG.RPC_RESULT: {
          const rpcMsg = msg as RpcResultMessage;
          const entry = pendingRpcs.get(rpcMsg.id);
          if (!entry) break;

          pendingRpcs.delete(rpcMsg.id);
          if (entry.timer) clearTimeout(entry.timer);
          if (rpcMsg.error) {
            entry.reject(new Error(rpcMsg.error));
          } else {
            entry.resolve(rpcMsg.result);
          }
          break;
        }
        case MSG.EVENT: {
          const evtMsg = msg as EventMessage;
          const key = `${evtMsg.actor}:${evtMsg.actorId}`;
          handles.get(key)?.handleMessage(msg);
          break;
        }
        case MSG.STATE_SNAPSHOT: {
          const snapMsg = msg as StateSnapshotMessage;
          const key = `${snapMsg.actor}:${snapMsg.actorId}`;
          handles.get(key)?.handleMessage(msg);
          break;
        }
        case MSG.STATE_PATCH: {
          const patchMsg = msg as StatePatchMessage;
          const key = `${patchMsg.actor}:${patchMsg.actorId}`;
          handles.get(key)?.handleMessage(msg);
          break;
        }
      }
    };

    socket.onclose = (event: CloseEvent) => {
      if (socket !== ws || epoch !== connectionEpoch) return;
      handleSocketClosed(socket, event.reason || "WebSocket closed");
    };

    socket.onerror = () => {
      if (socket !== ws || epoch !== connectionEpoch) return;
      connected = false;
    };
  }

  async function rpcSend(msg: RpcCallMessage): Promise<unknown> {
    const startedAt = Date.now();
    await waitForOpen(rpcTimeout);

    const socket = ws;
    if (!connected || !socket) {
      throw new Error("WebSocket is not connected");
    }

    return new Promise((resolve, reject) => {
      const elapsed = Date.now() - startedAt;
      const remaining = rpcTimeout > 0 ? Math.max(0, rpcTimeout - elapsed) : 0;
      let timer: ReturnType<typeof setTimeout> | undefined;

      if (rpcTimeout > 0) {
        if (remaining === 0) {
          reject(new Error(`RPC "${msg.method}" timed out after ${rpcTimeout}ms`));
          return;
        }
        timer = setTimeout(() => {
          pendingRpcs.delete(msg.id);
          reject(new Error(`RPC "${msg.method}" timed out after ${rpcTimeout}ms`));
        }, remaining);
      }

      pendingRpcs.set(msg.id, { resolve, reject, timer });

      try {
        socket.send(JSON.stringify(msg));
      } catch {
        pendingRpcs.delete(msg.id);
        if (timer) clearTimeout(timer);
        reject(new Error(`RPC "${msg.method}" could not be sent`));
      }
    });
  }

  connect();

  function getOrCreateHandle(actorName: string, actorId: string): ActorHandleImpl {
    const key = `${actorName}:${actorId}`;
    const pendingDispose = disposeTimers.get(key);
    if (pendingDispose !== undefined) {
      clearTimeout(pendingDispose);
      disposeTimers.delete(key);
    }

    let handle = handles.get(key);
    if (!handle) {
      handle = new ActorHandleImpl(actorName, actorId, wsSend, rpcSend);
      handles.set(key, handle);
      if (connected) {
        handle.syncSubscriptions(wsSend);
      }
    }

    handle.retain();
    return handle;
  }

  function releaseHandle(actorName: string, actorId: string): void {
    const key = `${actorName}:${actorId}`;
    const handle = handles.get(key);
    if (!handle) return;

    if (handle.release() === 0) {
      const timer = setTimeout(() => {
        disposeTimers.delete(key);
        if (handle.refCount !== 0) return;
        if (handles.get(key) !== handle) return;
        handle.dispose();
        handles.delete(key);
      }, 0);
      disposeTimers.set(key, timer);
    }
  }

  const closeClient = (): void => {
    wasClosedByUser = true;
    clearReconnectTimer();

    for (const timer of disposeTimers.values()) clearTimeout(timer);
    disposeTimers.clear();

    for (const handle of handles.values()) handle.dispose();
    handles.clear();

    rejectAllPendingRpcs("WebSocket client closed");

    const socket = ws;
    ws = null;
    connected = false;
    setStatus("disconnected");
    currentOpenWait.reject(new Error("WebSocket client closed"));
    settleReady.reject(new Error("WebSocket client closed before becoming ready"));

    if (socket) {
      try {
        socket.close();
      } catch {
        // ignore
      }
    }
  };

  const connectionApi: ClientConnection = {
    get ready() {
      return readyPromise;
    },
    get status() {
      return currentStatus;
    },
    get clientId() {
      return currentClientId;
    },
    subscribe(cb) {
      statusListeners.add(cb);
      return () => {
        statusListeners.delete(cb);
      };
    },
    close() {
      closeClient();
    },
  };

  const proxy = new Proxy({} as any, {
    get(_target, prop: string) {
      if (prop === "connection") return connectionApi;
      if (prop === "clientId") return currentClientId;
      if (prop === "$close") {
        return closeClient;
      }

      if (prop === "$ready") return readyPromise;
      if (prop === "$status") return currentStatus;

      if (prop === "on") {
        return (event: string, cb: (payload: any) => void): Unsubscribe => {
          if (event === "status") {
            statusListeners.add(cb);
            return () => { statusListeners.delete(cb); };
          }
          return () => {};
        };
      }

      return (actorId: string) => {
        const impl = getOrCreateHandle(prop, actorId);

        return new Proxy({} as any, {
          get(_t, methodOrProp: string) {
            if (methodOrProp === "on") {
              return (event: string, cb: (payload: unknown) => void) =>
                impl.on(event, cb);
            }
            if (methodOrProp === "state") return impl.state;
            if (methodOrProp === "meta") {
              return {
                name: impl.actorName,
                id: impl.actorId,
                dispose: () => releaseHandle(prop, actorId),
              };
            }
            if (methodOrProp === "$actorName") return impl.actorName;
            if (methodOrProp === "$actorId") return impl.actorId;
            if (methodOrProp === "$dispose") return () => releaseHandle(prop, actorId);

            return (input?: unknown) => impl.call(methodOrProp, input);
          },
        });
      };
    },
  });

  return proxy;
}
