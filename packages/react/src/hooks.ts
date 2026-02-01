import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
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

export type CallState<TOutput> = {
  data: TOutput | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
};

export type MutationState<TInput, TOutput> = {
  data: TOutput | null;
  loading: boolean;
  error: Error | null;
  mutate: (input: TInput) => void;
  mutateAsync: (input: TInput) => Promise<TOutput>;
  reset: () => void;
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

/**
 * Make an RPC call with automatic loading/error state management.
 *
 * @param client - The Zocket client instance
 * @param caller - Function that takes client and returns a promise
 * @param deps - Dependency array for re-fetching
 * @param options - Optional configuration (enabled)
 */
export function useCall<TRouter extends AnyRouter, TOutput>(
  client: ZocketClient<TRouter>,
  caller: (client: ZocketClient<TRouter>) => Promise<TOutput>,
  deps: DependencyList,
  options?: { enabled?: boolean }
): CallState<TOutput> {
  const enabled = options?.enabled ?? true;

  const [state, setState] = useState<Omit<CallState<TOutput>, "refetch">>({
    data: null,
    loading: enabled,
    error: null,
  });

  const isMountedRef = useRef(false);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const requestIdRef = useRef(0);

  const callerRef = useRef(caller);
  useIsomorphicLayoutEffect(() => {
    callerRef.current = caller;
  });

  const fetchData = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await callerRef.current(client);
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      setState({ data: result, loading: false, error: null });
    } catch (err) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      setState({
        data: null,
        loading: false,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }, [client]);

  useEffect(() => {
    if (!enabled) {
      requestIdRef.current++;
      setState({ data: null, loading: false, error: null });
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, fetchData, ...deps]);

  return {
    ...state,
    refetch: fetchData,
  };
}

/**
 * Create a mutation for imperative RPC calls.
 *
 * @param client - The Zocket client instance
 * @param mutationFn - Function that takes client and input, returns a promise
 */
export function useMutation<TRouter extends AnyRouter, TInput, TOutput>(
  client: ZocketClient<TRouter>,
  mutationFn: (client: ZocketClient<TRouter>, input: TInput) => Promise<TOutput>
): MutationState<TInput, TOutput> {
  const [state, setState] = useState<
    Omit<MutationState<TInput, TOutput>, "mutate" | "mutateAsync" | "reset">
  >({
    data: null,
    loading: false,
    error: null,
  });

  const mutationFnRef = useRef(mutationFn);
  useIsomorphicLayoutEffect(() => {
    mutationFnRef.current = mutationFn;
  });

  const mutateAsync = useCallback(
    async (input: TInput): Promise<TOutput> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const result = await mutationFnRef.current(client, input);
        setState({ data: result, loading: false, error: null });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState({ data: null, loading: false, error });
        throw error;
      }
    },
    [client]
  );

  const mutate = useCallback(
    (input: TInput) => {
      mutateAsync(input).catch(() => {
        // Error is already captured in state, swallow to avoid unhandled rejection
      });
    },
    [mutateAsync]
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    mutate,
    mutateAsync,
    reset,
  };
}
