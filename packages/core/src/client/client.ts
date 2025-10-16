import ReconnectingWebSocket from "reconnecting-websocket";
import type { AnyRouter } from "../core/types";
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
  maxReconnectionDelay: 10000,
  minReconnectionDelay: 1000,
  reconnectionDelayGrowFactor: 1.3,
  maxRetries: Infinity,
  debug: false,
} as const;

function isValidMessage(data: unknown): data is Message {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    typeof data.type === "string"
  );
}

export function createZocketClient<TRouter extends AnyRouter>(
  url: string,
  options?: {
    maxReconnectionDelay?: number;
    minReconnectionDelay?: number;
    reconnectionDelayGrowFactor?: number;
    maxRetries?: number;
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

  const socket = new ReconnectingWebSocket(wsUrl.toString(), [], {
    WebSocket: globalThis.WebSocket,
    maxReconnectionDelay:
      options?.maxReconnectionDelay ?? DEFAULT_OPTIONS.maxReconnectionDelay,
    minReconnectionDelay:
      options?.minReconnectionDelay ?? DEFAULT_OPTIONS.minReconnectionDelay,
    reconnectionDelayGrowFactor:
      options?.reconnectionDelayGrowFactor ??
      DEFAULT_OPTIONS.reconnectionDelayGrowFactor,
    maxRetries: options?.maxRetries ?? DEFAULT_OPTIONS.maxRetries,
    debug,
  });

  socket.binaryType = "arraybuffer";

  socket.addEventListener("open", () => {
    log("Connected");
    options?.onOpen?.();
    openListeners.forEach((cb) => cb());
  });

  socket.addEventListener("close", () => {
    log("Disconnected");
    options?.onClose?.();
    closeListeners.forEach((cb) => cb());
  });

  socket.addEventListener("error", (err) => {
    error("WebSocket error:", err);
  });

  socket.addEventListener("message", (event) => {
    try {
      const data: unknown = JSON.parse(event.data);

      if (!isValidMessage(data)) {
        warn("Invalid message format received:", data);
        return;
      }

      const { type, payload } = data;
      const listeners = eventListeners.get(type);
      listeners?.forEach((callback) => callback(payload));
    } catch (e) {
      error("Failed to parse message:", e);
    }
  });

  const sendMessage = (route: string, payload: unknown) => {
    const message = JSON.stringify({ type: route, payload });

    if (socket.readyState !== ReconnectingWebSocket.OPEN) {
      warn(
        `WebSocket not open (state: ${socket.readyState}). Message queued for "${route}"`
      );
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

  const createProxy = (path: string[]): any => {
    return new Proxy(() => {}, {
      get: (_target, prop: string) => createProxy([...path, prop]),
      apply: (_target, _thisArg, args) => {
        const [callback] = args;
        const [command, ...routeParts] = path;
        const route = routeParts.join(".");

        if (command === COMMANDS.SEND) {
          sendMessage(route, callback);
          return;
        }

        if (command === COMMANDS.ON) {
          return subscribeToEvent(route, callback);
        }
      },
    });
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
    close: () => socket.close(),
    reconnect: () => socket.reconnect(),
    get readyState() {
      return socket.readyState;
    },
  };
}
