import {
  createContext,
  useContext,
  useRef,
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

// ---------------------------------------------------------------------------
// createZocketReact — factory that produces typed hooks + provider
// ---------------------------------------------------------------------------

type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

type ClientWithExtras<TApp extends AppDef<any>> = ClientApi<TApp> & {
  connection: {
    ready: Promise<void>;
    status: ConnectionStatus;
    subscribe(cb: (status: ConnectionStatus) => void): () => void;
    close(): void;
  };
  on(event: "status", cb: (status: ConnectionStatus) => void): () => void;
};

/**
 * Structural shape accepted by hooks — any object with `.state`, `.on`,
 * `.$actorName`, `.$actorId` matching an ActorHandle.
 * Avoids the need for phantom types or conditional-type unwrapping.
 */
interface HandleLike<TState = unknown> {
  on: (...args: any[]) => any;
  state: {
    subscribe: (listener: (state: TState) => void) => Unsubscribe;
    getSnapshot: () => TState | undefined;
  };
  meta?: {
    dispose?: () => void;
  };
  $actorName: string;
  $actorId: string;
}

export function createZocketReact<TApp extends AppDef<any>>() {
  const ClientContext = createContext<ClientWithExtras<TApp> | null>(null);

  function ZocketProvider({
    client,
    children,
  }: {
    client: ClientWithExtras<TApp>;
    children: ReactNode;
  }) {
    return (
      <ClientContext.Provider value={client}>{children}</ClientContext.Provider>
    );
  }

  function useClient(): ClientWithExtras<TApp> {
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
    const client = useClient();
    const ref = useRef<{ key: string; handle: ReturnType<ClientApi<TApp>[K]> } | null>(
      null,
    );

    const key = `${String(actorName)}:${actorId}`;
    if (!ref.current || ref.current.key !== key) {
      const factory = (client as any)[actorName] as (id: string) => any;
      ref.current = { key, handle: factory(actorId) };
    }

    useEffect(() => {
      const current = ref.current;
      return () => {
        current?.handle.meta?.dispose?.();
        current?.handle.$dispose?.();
        ref.current = null;
      };
    }, [key]);

    return ref.current.handle;
  }

  /**
   * Lifecycle wrapper for actor events — subscribes on mount, unsubscribes on unmount.
   *
   * For **full type inference** on event names and payloads, use `room.on()` directly.
   * `room.on("message", cb)` already infers the payload type from your actor definition.
   * This hook exists purely for React lifecycle convenience (auto-cleanup).
   *
   * ```tsx
   * // Typed — payload is inferred:
   * useEvent(room, "message", (payload) => { playSound() })
   *
   * // Equivalent manual approach with full types:
   * useEffect(() => room.on("message", (msg) => playSound()), [room])
   * ```
   */
  function useEvent<TState>(
    handle: HandleLike<TState>,
    event: string,
    callback: (payload: any) => void,
  ): void {
    const cbRef = useRef(callback);
    cbRef.current = callback;

    useEffect(() => {
      const unsub = handle.on(event, (payload: any) => {
        cbRef.current(payload);
      });
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
      selected: TSelected | undefined;
    }>({ state: undefined, selected: undefined });

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

      if (rawState !== cacheRef.current.state) {
        cacheRef.current.state = rawState;
        cacheRef.current.selected = sel(rawState);
      }
      return cacheRef.current.selected;
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
