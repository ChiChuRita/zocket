import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AnyRouter } from "@zocket/core";
import type { ZocketClient } from "@zocket/client";
import { ZocketContext } from "./context";

type UnsubscribeFn = () => void;
type SubscribeFn<T> = (callback: (data: T) => void) => UnsubscribeFn;

export function useEvent<T>(
  subscribe: SubscribeFn<T>,
  handler: (data: T) => void,
  deps: React.DependencyList = []
) {
  const handlerRef = useRef(handler);

  useLayoutEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const unsubscribe = subscribe((data) => {
      handlerRef.current(data);
    });
    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, ...deps]);
}

export type ConnectionStatus = "connecting" | "open" | "closed";

export type ConnectionState = {
  status: ConnectionStatus;
  readyState: number;
  lastError: unknown | null;
};

function getConnectionStatus(readyState: number): ConnectionStatus {
  // WebSocket readyState: 0 CONNECTING, 1 OPEN, 2 CLOSING, 3 CLOSED
  if (readyState === 0) return "connecting";
  if (readyState === 1) return "open";
  return "closed";
}

export function useConnectionState<TRouter extends AnyRouter>(
  client: ZocketClient<TRouter>
): ConnectionState {
  const [state, setState] = useState<ConnectionState>(() => {
    const readyState = client.readyState;
    return {
      readyState,
      status: getConnectionStatus(readyState),
      lastError: client.lastError,
    };
  });

  useEffect(() => {
    const update = () => {
      const readyState = client.readyState;
      setState({
        readyState,
        status: getConnectionStatus(readyState),
        lastError: client.lastError,
      });
    };

    const offOpen = client.onOpen(update);
    const offClose = client.onClose(update);
    const offError = client.onError(() => update());

    // Ensure we reflect the latest state even if it changed before effects ran.
    update();

    return () => {
      offOpen();
      offClose();
      offError();
    };
  }, [client]);

  return state;
}

export function useZocket<TRouter extends AnyRouter>() {
  const context = useContext(ZocketContext);
  if (!context) {
    throw new Error("useZocket must be used within a ZocketProvider");
  }
  return {
    client: context.client as ZocketClient<TRouter>,
    useEvent,
  };
}
