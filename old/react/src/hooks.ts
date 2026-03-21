import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DependencyList,
} from "react";
import type { AnyRouter } from "@zocket/core";
import type { ZocketClient } from "@zocket/client";

// ============================================================================
// Types
// ============================================================================

type UnsubscribeFn = () => void;
type SubscribeFn<T> = (callback: (data: T) => void) => UnsubscribeFn;

export type ConnectionStatus = "connecting" | "open" | "closed";

export type ConnectionState = {
  status: ConnectionStatus;
  readyState: number;
  lastError: unknown | null;
};

// ============================================================================
// Helpers
// ============================================================================

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function getConnectionStatus(readyState: number): ConnectionStatus {
  if (readyState === 0) return "connecting";
  if (readyState === 1) return "open";
  return "closed";
}

// ============================================================================
// Standalone Hooks (Logic only, no context)
// ============================================================================

/**
 * Subscribe to events from the server.
 *
 * @param subscribe - The subscription function from client.on.xxx
 * @param handler - Callback when event is received
 * @param deps - Optional dependency array for re-subscribing
 */
export function useEvent<T>(
  subscribe: SubscribeFn<T>,
  handler: (data: T) => void,
  deps: DependencyList = []
): void {
  const handlerRef = useRef(handler);

  useIsomorphicLayoutEffect(() => {
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

/**
 * Track the WebSocket connection state.
 *
 * @param client - The Zocket client instance
 * @returns Connection state with status, readyState, and lastError
 */
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

    // Sync state in case it changed before effects ran
    update();

    return () => {
      offOpen();
      offClose();
      offError();
    };
  }, [client]);

  return state;
}
