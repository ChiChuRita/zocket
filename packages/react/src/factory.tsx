import React, { createContext, useContext, type DependencyList, type ReactNode } from "react";
import type { AnyRouter } from "@zocket/core";
import type { ZocketClient } from "@zocket/client";

import type {
  ConnectionState,
  CallState,
  MutationState,
} from "./hooks";

import {
  useConnectionState as useConnectionStateBase,
  useEvent as useEventBase,
  useCall as useCallBase,
  useMutation as useMutationBase,
} from "./hooks";

// ============================================================================
// Types
// ============================================================================

type UnsubscribeFn = () => void;
type SubscribeFn<T> = (callback: (data: T) => void) => UnsubscribeFn;

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
    return useConnectionStateBase(client);
  }

  // -------------------------------------------------------------------------
  // useEvent
  // -------------------------------------------------------------------------
  function useEvent<T>(
    subscribe: SubscribeFn<T>,
    handler: (data: T) => void,
    deps: DependencyList = []
  ): void {
    return useEventBase(subscribe, handler, deps);
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
    return useCallBase(client, caller, deps, options);
  }

  // -------------------------------------------------------------------------
  // useMutation
  // -------------------------------------------------------------------------
  function useMutation<TInput, TOutput>(
    mutationFn: (client: ZocketClient<TRouter>, input: TInput) => Promise<TOutput>
  ): MutationState<TInput, TOutput> {
    const client = useClient();
    return useMutationBase(client, mutationFn);
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
