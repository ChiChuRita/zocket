import {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useCallback,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type {
  AppDef,
  ClientApi,
  Unsubscribe,
} from "@zocket/core";
import type { ClientConnection, ConnectionStatus } from "@zocket/client";

// ---------------------------------------------------------------------------
// createZocketReact — factory that produces typed hooks + provider
// ---------------------------------------------------------------------------

type ZocketClient<TApp extends AppDef<any>> = ClientApi<TApp> & {
  connection: ClientConnection;
  on(event: "status", cb: (status: ConnectionStatus) => void): Unsubscribe;
};

/**
 * Structural shape accepted by hooks — any object with a ref-counted `meta`,
 * event subscription via `on`, and a readable/subscribable `state`.
 * Avoids the need for phantom types or conditional-type unwrapping.
 */
interface HandleLike<TState = unknown, TEvents extends Record<string, any> = Record<string, any>> {
  on: <K extends keyof TEvents & string>(
    event: K,
    callback: (payload: TEvents[K]) => void,
  ) => Unsubscribe;
  state: {
    subscribe: (listener: (state: TState) => void) => Unsubscribe;
    getSnapshot: () => TState | undefined;
  };
  meta: {
    name: string;
    id: string;
    dispose: () => void;
  };
}

export function createZocketReact<TApp extends AppDef<any>>() {
  const ClientContext = createContext<ZocketClient<TApp> | null>(null);

  function ZocketProvider({
    client,
    children,
  }: {
    client: ZocketClient<TApp>;
    children: ReactNode;
  }) {
    return (
      <ClientContext.Provider value={client}>{children}</ClientContext.Provider>
    );
  }

  function useClient(): ZocketClient<TApp> {
    const client = useContext(ClientContext);
    if (!client) {
      throw new Error("useClient must be used within <ZocketProvider>");
    }
    return client;
  }

  /**
   * Get a stable, fully-typed ActorHandle for the given actor name + id.
   * The handle is ref-counted, so multiple components can share the same
   * actor without one unmount killing the other's connection.
   *
   * All methods, events, and state are automatically typed from your actor definition —
   * no manual type annotations needed.
   *
   * ```tsx
   * const room = useActor("chat", roomId)
   * await room.sendMessage({ text: "hi" })        // typed input + return
   * room.on("message", (msg) => console.log(msg))  // typed payload
   * ```
   */
  function useActor<K extends keyof ClientApi<TApp>>(
    actorName: K,
    actorId: string,
  ): ReturnType<ClientApi<TApp>[K]> {
    type Handle = ReturnType<ClientApi<TApp>[K]>;
    const client = useClient();
    const key = `${String(actorName)}:${actorId}`;

    const [handle, setHandle] = useState<Handle>(
      () => (client as any)[actorName](actorId),
    );

    const prevKeyRef = useRef(key);
    const prevClientRef = useRef(client);

    if (prevKeyRef.current !== key || prevClientRef.current !== client) {
      const next: Handle = (client as any)[actorName](actorId);
      prevKeyRef.current = key;
      prevClientRef.current = client;
      setHandle(next);
    }

    useEffect(() => {
      return () => {
        (handle as any).meta?.dispose?.();
      };
    }, [handle]);

    return handle;
  }

  /**
   * Lifecycle wrapper for actor events — subscribes on mount, unsubscribes on unmount.
   *
   * Event name and payload are inferred from the handle's `on` signature.
   *
   * ```tsx
   * useEvent(room, "message", (payload) => { playSound() })
   * ```
   */
  function useEvent<
    H extends { on: (event: any, callback: any) => Unsubscribe },
    E extends Parameters<H["on"]>[0],
  >(
    handle: H,
    event: E,
    callback: Parameters<H["on"] extends (e: E, cb: infer C) => any ? H["on"] : never>[1] extends infer Cb
      ? Cb
      : never,
  ): void {
    const cbRef = useRef(callback);
    cbRef.current = callback;

    useEffect(() => {
      const unsub = handle.on(event, ((payload: unknown) => {
        (cbRef.current as any)(payload);
      }) as any);
      return unsub;
    }, [handle, event]);
  }

  /**
   * Subscribe to actor state with an optional selector. Re-renders only when
   * the selected value changes (shallow compare).
   *
   * TState is inferred structurally from the handle's `state.subscribe` signature.
   *
   * ```tsx
   * const messages = useActorState(room, s => s.messages)
   * const fullState = useActorState(room)
   * ```
   */
  function useActorState<TState, TSelected = TState>(
    handle: HandleLike<TState>,
    selector?: (state: TState) => TSelected,
  ): TSelected | undefined {
    const selectorRef = useRef(selector);
    selectorRef.current = selector;

    const cacheRef = useRef<{
      state: unknown;
      selector: ((state: TState) => TSelected) | undefined;
      selected: TSelected | undefined;
    }>({ state: undefined, selector: undefined, selected: undefined });

    const subscribe = useCallback(
      (onStoreChange: () => void) => {
        const unsub = handle.state.subscribe(() => {
          onStoreChange();
        });
        return unsub;
      },
      [handle],
    );

    const getSnapshot = useCallback((): TSelected | undefined => {
      const rawState = handle.state.getSnapshot();
      if (rawState === undefined) return undefined;

      const sel = selectorRef.current;
      if (!sel) return rawState as TSelected;

      const cache = cacheRef.current;
      if (rawState !== cache.state || sel !== cache.selector) {
        cache.state = rawState;
        cache.selector = sel;
        cache.selected = sel(rawState);
      }
      return cache.selected;
    }, [handle]);

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  }

  /**
   * Returns the current WebSocket connection status.
   * Re-renders automatically when the status changes.
   *
   * ```tsx
   * const status = useConnectionStatus()
   * if (status === "reconnecting") return <Banner>Reconnecting...</Banner>
   * ```
   */
  function useConnectionStatus(): ConnectionStatus {
    const client = useClient();

    const subscribe = useCallback(
      (onStoreChange: () => void) => client.connection.subscribe(() => onStoreChange()),
      [client],
    );

    const getSnapshot = useCallback(
      () => client.connection.status,
      [client],
    );

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  }

  return {
    ZocketProvider,
    useClient,
    useActor,
    useEvent,
    useActorState,
    useConnectionStatus,
  };
}
