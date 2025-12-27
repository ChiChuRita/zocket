import type { AnyRouter } from "@zocket/core";
import type { ClientOn, ClientSend, ZocketClient } from "./types";

type MessageCallback = (payload: unknown) => void;

type Message = {
  type: string;
  payload: unknown;
};

const COMMANDS = {
  SEND: "send",
  ON: "on",
} as const;

const DEFAULT_OPTIONS = {
  debug: false,
} as const;

function isValidMessage(data: unknown): data is Message {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    typeof (data as any).type === "string"
  );
}

export function createZocketClient<TRouter extends AnyRouter>(
  url: string,
  options?: {
    debug?: boolean;
    headers?: Record<string, string>;
    onOpen?: () => void;
    onClose?: () => void;
  }
): ZocketClient<TRouter> {
  const debug = options?.debug ?? DEFAULT_OPTIONS.debug;
  const eventListeners = new Map<string, Set<MessageCallback>>();
  const openListeners = new Set<() => void>();
  const closeListeners = new Set<() => void>();
  const errorListeners = new Set<(error: unknown) => void>();
  let lastError: unknown | null = null;

  const WebSocketImpl = globalThis.WebSocket;

  if (!WebSocketImpl) {
    throw new Error(
      "WebSocket is not available in the current environment. " +
        "Make sure to run the client in a browser or provide a WebSocket implementation."
    );
  }

  const log = (...args: unknown[]) => debug && console.log("CLIENT:", ...args);
  const warn = (...args: unknown[]) =>
    debug && console.warn("CLIENT:", ...args);
  const error = (...args: unknown[]) => console.error("CLIENT:", ...args);

  const wsUrl = new URL(url);
  if (options?.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      wsUrl.searchParams.set(key, value);
    });
  }
  let socket: WebSocket | null = null;

  const decodeMessageData = (event: MessageEvent): string | null => {
    if (typeof event.data === "string") {
      return event.data;
    }

    if (event.data instanceof ArrayBuffer) {
      return new TextDecoder().decode(event.data);
    }

    warn("Unsupported message data type received:", event.data);
    return null;
  };

  const attachSocket = () => {
    // Starting a new connection attempt: clear previous error.
    lastError = null;
    const ws = new WebSocketImpl(wsUrl.toString());
    socket = ws;
    ws.binaryType = "arraybuffer";

    ws.addEventListener("open", () => {
      if (socket !== ws) {
        // Another socket became active before this one opened.
        return;
      }
      log("Connected");
      lastError = null;
      options?.onOpen?.();
      openListeners.forEach((cb) => cb());
    });

    ws.addEventListener("close", () => {
      if (socket === ws) {
        socket = null;
      }
      log("Disconnected");
      options?.onClose?.();
      closeListeners.forEach((cb) => cb());
    });

    ws.addEventListener("error", (err) => {
      if (socket !== ws) {
        return;
      }
      lastError = err;
      error("WebSocket error:", err);
      errorListeners.forEach((cb) => cb(err));
    });

    ws.addEventListener("message", (event) => {
      if (socket !== ws) {
        return;
      }

      const raw = decodeMessageData(event);

      if (raw === null) {
        return;
      }

      try {
        const data: unknown = JSON.parse(raw);

        if (!isValidMessage(data)) {
          warn("Invalid message format received:", data);
          return;
        }

        const { type, payload } = data as Message;
        const listeners = eventListeners.get(type);
        listeners?.forEach((callback) => callback(payload));
      } catch (e) {
        error("Failed to parse message:", e);
      }
    });
  };

  attachSocket();

  const sendMessage = (route: string, payload: unknown) => {
    const message = JSON.stringify({ type: route, payload });

    if (!socket) {
      warn(
        `WebSocket not initialized. Message dropped for "${route}" with payload:`,
        payload
      );
      return;
    }

    if (socket.readyState !== WebSocketImpl.OPEN) {
      warn(
        `WebSocket not open (state: ${socket.readyState}). Message dropped for "${route}"`
      );
      return;
    }

    socket.send(message);
  };

  const subscribeToEvent = (route: string, callback: MessageCallback) => {
    if (!eventListeners.has(route)) {
      eventListeners.set(route, new Set());
    }
    const listeners = eventListeners.get(route)!;
    listeners.add(callback);
    return () => listeners.delete(callback);
  };

  /**
   * IMPORTANT FOR REACT:
   * We cache proxy chains so expressions like `client.on.chat.onMessage`
   * have stable identity across renders (avoids unnecessary resubscribe loops).
   */
  const proxyCache = new Map<string, any>();

  const createProxy = (path: string[]): any => {
    const key = path.join(".");
    const cached = proxyCache.get(key);
    if (cached) return cached;

    const proxy = new Proxy(() => {}, {
      get: (target, prop: string | symbol, receiver) => {
        // Avoid "thenable" behavior (can confuse Promise/await utilities)
        if (prop === "then") return undefined;
        if (typeof prop !== "string") {
          return Reflect.get(target, prop, receiver);
        }
        return createProxy([...path, prop]);
      },
      apply: (_target, _thisArg, args) => {
        const [arg0] = args;
        const [command, ...routeParts] = path;
        const route = routeParts.join(".");

        if (command === COMMANDS.SEND) {
          sendMessage(route, arg0);
          return;
        }

        if (command === COMMANDS.ON) {
          return subscribeToEvent(route, arg0);
        }
      },
    });

    proxyCache.set(key, proxy);
    return proxy;
  };

  return {
    send: createProxy([COMMANDS.SEND]) as ClientSend<TRouter>,
    on: createProxy([COMMANDS.ON]) as ClientOn<TRouter>,
    onOpen: (callback: () => void) => {
      openListeners.add(callback);
      return () => openListeners.delete(callback);
    },
    onClose: (callback: () => void) => {
      closeListeners.add(callback);
      return () => closeListeners.delete(callback);
    },
    onError: (callback: (error: unknown) => void) => {
      errorListeners.add(callback);
      return () => errorListeners.delete(callback);
    },
    close: () => {
      if (!socket) {
        return;
      }

      try {
        socket.close();
      } catch (e) {
        error("Failed to close socket:", e);
      }
    },
    reconnect: () => {
      if (!socket || socket.readyState === WebSocketImpl.CLOSED) {
        attachSocket();
        return;
      }

      const currentSocket = socket;
      const reconnectAfterClose = () => {
        currentSocket.removeEventListener("close", reconnectAfterClose);
        if (socket === currentSocket) {
          socket = null;
        }
        attachSocket();
      };

      currentSocket.addEventListener("close", reconnectAfterClose, {
        once: true,
      });

      try {
        currentSocket.close();
      } catch (e) {
        error("Failed to close socket before reconnect:", e);
        currentSocket.removeEventListener("close", reconnectAfterClose);
        attachSocket();
      }
    },
    get readyState() {
      return socket?.readyState ?? WebSocketImpl.CLOSED;
    },
    get lastError() {
      return lastError;
    },
  };
}
