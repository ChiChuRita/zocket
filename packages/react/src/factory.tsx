import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
  type DependencyList,
} from "react";
import type { AnyRouter } from "@zocket/core";
import type { ZocketClient } from "@zocket/client";

// ============================================================================
// Types
// ============================================================================

type UnsubscribeFn = () => void;
type SubscribeFn<T> = (callback: (data: T) => void) => UnsubscribeFn;

import type {
  ConnectionState,
  ConnectionStatus,
  CallState,
  MutationState,
} from "./hooks";

export interface ZocketReactHooks<TRouter extends AnyRouter> {
  /**
   * Provider component that wraps your app and provides the Zocket client
   */
  ZocketProvider: React.FC<{
    client: ZocketClient<TRouter>;
    children: ReactNode;
  }>;

  /**
   * Get the typed Zocket client instance
   */
  useClient: () => ZocketClient<TRouter>;

  /**
   * Track the WebSocket connection state
   */
  useConnectionState: () => ConnectionState;

  /**
   * Subscribe to events from the server
   * @param subscribe - The subscription function (e.g., client.on.chat.message)
   * @param handler - Callback when event is received
   * @param deps - Optional dependency array for re-subscribing
   */
  useEvent: <T>(
    subscribe: SubscribeFn<T>,
    handler: (data: T) => void,
    deps?: DependencyList
  ) => void;

  /**
   * Make an RPC call with automatic loading/error state management
   * @param caller - Function that takes client and returns a promise
   * @param deps - Dependency array for re-fetching
   * @param options - Optional configuration
   */
  useCall: <TOutput>(
    caller: (client: ZocketClient<TRouter>) => Promise<TOutput>,
    deps: DependencyList,
    options?: { enabled?: boolean }
  ) => CallState<TOutput>;

  /**
   * Create a mutation for imperative RPC calls
   * @param mutationFn - Function that takes client and input, returns a promise
   */
  useMutation: <TInput, TOutput>(
    mutationFn: (client: ZocketClient<TRouter>, input: TInput) => Promise<TOutput>
  ) => MutationState<TInput, TOutput>;
}

// ============================================================================
// Helpers
// ============================================================================

function getConnectionStatus(readyState: number): ConnectionStatus {
  if (readyState === 0) return "connecting";
  if (readyState === 1) return "open";
  return "closed";
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create typed React hooks for your Zocket router.
 *
 * @example
 * ```tsx
 * // lib/zocket.ts
 * import { createZocketReact } from '@zocket/react';
 * import type { AppRouter } from './server';
 *
 * export const zocket = createZocketReact<AppRouter>();
 *
 * // App.tsx
 * import { zocket } from './lib/zocket';
 * import { createZocketClient } from '@zocket/client';
 *
 * const client = createZocketClient<AppRouter>('ws://localhost:3000');
 *
 * function App() {
 *   return (
 *     <zocket.ZocketProvider client={client}>
 *       <MyComponent />
 *     </zocket.ZocketProvider>
 *   );
 * }
 *
 * function MyComponent() {
 *   const client = zocket.useClient();
 *   const { status } = zocket.useConnectionState();
 *
 *   zocket.useEvent(client.on.chat.message, (msg) => {
 *     console.log('New message:', msg);
 *   });
 *
 *   const { data, loading } = zocket.useCall(
 *     (c) => c.users.getProfile({ id: 1 }),
 *     [1]
 *   );
 *
 *   const sendMessage = zocket.useMutation(
 *     (c, input: { text: string }) => c.chat.send(input)
 *   );
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function createZocketReact<
  TRouter extends AnyRouter
>(): ZocketReactHooks<TRouter> {
  // Create a context specific to this router type
  const ZocketClientContext = createContext<ZocketClient<TRouter> | null>(null);

  // -------------------------------------------------------------------------
  // ZocketProvider
  // -------------------------------------------------------------------------
  function ZocketProvider({
    client,
    children,
  }: {
    client: ZocketClient<TRouter>;
    children: ReactNode;
  }) {
    return (
      <ZocketClientContext.Provider value={client}>
        {children}
      </ZocketClientContext.Provider>
    );
  }

  // -------------------------------------------------------------------------
  // useClient
  // -------------------------------------------------------------------------
  function useClient(): ZocketClient<TRouter> {
    const client = useContext(ZocketClientContext);
    if (!client) {
      throw new Error(
        "useClient must be used within a ZocketProvider. " +
        "Make sure to wrap your component tree with <ZocketProvider client={...}>."
      );
    }
    return client;
  }

  // -------------------------------------------------------------------------
  // useConnectionState
  // -------------------------------------------------------------------------
  function useConnectionState(): ConnectionState {
    const client = useClient();

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

  // -------------------------------------------------------------------------
  // useEvent
  // -------------------------------------------------------------------------
  function useEvent<T>(
    subscribe: SubscribeFn<T>,
    handler: (data: T) => void,
    deps: DependencyList = []
  ): void {
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

  // -------------------------------------------------------------------------
  // useCall
  // -------------------------------------------------------------------------
  function useCall<TOutput>(
    caller: (client: ZocketClient<TRouter>) => Promise<TOutput>,
    deps: DependencyList,
    options?: { enabled?: boolean }
  ): CallState<TOutput> {
    const client = useClient();
    const enabled = options?.enabled ?? true;

    const [state, setState] = useState<Omit<CallState<TOutput>, "refetch">>({
      data: null,
      loading: enabled,
      error: null,
    });

    const callerRef = useRef(caller);
    useLayoutEffect(() => {
      callerRef.current = caller;
    });

    const fetchData = useCallback(async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const result = await callerRef.current(client);
        setState({ data: result, loading: false, error: null });
      } catch (err) {
        setState({
          data: null,
          loading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    }, [client]);

    useEffect(() => {
      if (!enabled) {
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

  // -------------------------------------------------------------------------
  // useMutation
  // -------------------------------------------------------------------------
  function useMutation<TInput, TOutput>(
    mutationFn: (client: ZocketClient<TRouter>, input: TInput) => Promise<TOutput>
  ): MutationState<TInput, TOutput> {
    const client = useClient();

    const [state, setState] = useState<
      Omit<MutationState<TInput, TOutput>, "mutate" | "mutateAsync" | "reset">
    >({
      data: null,
      loading: false,
      error: null,
    });

    const mutationFnRef = useRef(mutationFn);
    useLayoutEffect(() => {
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

  // -------------------------------------------------------------------------
  // Return all hooks
  // -------------------------------------------------------------------------
  return {
    ZocketProvider,
    useClient,
    useConnectionState,
    useEvent,
    useCall,
    useMutation,
  };
}
