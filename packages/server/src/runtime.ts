import { enablePatches, setAutoFreeze, createDraft, finishDraft, type Patch } from "immer";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  ActorDef,
  InferSchema,
  JsonPatchOp,
} from "@zocket/core/types";
import { event as eventMsg, statePatch, stateSnapshot } from "@zocket/core/protocol";

enablePatches();
setAutoFreeze(false);

// ---------------------------------------------------------------------------
// Connection abstraction (runtime-agnostic)
// ---------------------------------------------------------------------------

export interface Connection {
  send(message: string): void;
  /** Stable identifier for lifecycle hooks. Assigned by the adapter. */
  id: string;
}

// ---------------------------------------------------------------------------
// Immer patch → JSON Patch (RFC 6902) conversion
// ---------------------------------------------------------------------------

function toJsonPatch(immerPatches: Patch[]): JsonPatchOp[] {
  return immerPatches.map((p) => {
    const path = "/" + p.path.map(String).join("/");
    switch (p.op) {
      case "add":
        return { op: "add" as const, path, value: p.value };
      case "remove":
        return { op: "remove" as const, path };
      case "replace":
        return { op: "replace" as const, path, value: p.value };
    }
  });
}

// ---------------------------------------------------------------------------
// ActorInstance
// ---------------------------------------------------------------------------

interface QueueItem {
  run: () => Promise<void>;
}

export class ActorInstance<TDef extends ActorDef<any, any, any> = ActorDef> {
  readonly actorName: string;
  readonly actorId: string;

  private state: InferSchema<TDef["config"]["state"]>;
  private def: TDef;
  private queue: QueueItem[] = [];
  private processing = false;

  /** Connections subscribed to events for this actor instance */
  private eventSubscribers = new Set<Connection>();
  /** Connections subscribed to state patches for this actor instance */
  private stateSubscribers = new Set<Connection>();
  /** All connections that have been seen (for lifecycle tracking) */
  private knownConnections = new Set<string>();

  constructor(actorName: string, actorId: string, def: TDef, initialState: unknown) {
    this.actorName = actorName;
    this.actorId = actorId;
    this.def = def;
    this.state = initialState as InferSchema<TDef["config"]["state"]>;
  }

  // -----------------------------------------------------------------------
  // Actor lifecycle hooks
  // -----------------------------------------------------------------------

  /** Called by the manager after the instance is created. */
  activate(): void {
    const handler = (this.def.config as any).onActivate;
    if (!handler) return;
    this.queue.push({
      run: async () => {
        const draft = createDraft(this.state as any);
        let result: unknown = handler({ state: draft });
        if (result instanceof Promise) await result;
        this.state = finishDraft(draft) as any;
      },
    });
    this.drain();
  }

  /** Called by the manager before the instance is destroyed. Returns a promise that resolves when done. */
  deactivate(): Promise<void> {
    const handler = (this.def.config as any).onDeactivate;
    if (!handler) return Promise.resolve();
    return new Promise((resolve) => {
      this.queue.push({
        run: async () => {
          const draft = createDraft(this.state as any);
          let result: unknown = handler({ state: draft });
          if (result instanceof Promise) await result;
          this.state = finishDraft(draft) as any;
          resolve();
        },
      });
      this.drain();
    });
  }

  /** Get a snapshot of the current state (for persistence). */
  getState(): unknown {
    return this.state;
  }

  // -----------------------------------------------------------------------
  // Event & state subscriptions
  // -----------------------------------------------------------------------

  subscribeEvents(conn: Connection): void {
    this.eventSubscribers.add(conn);
    this.trackConnect(conn);
  }

  unsubscribeEvents(conn: Connection): void {
    this.eventSubscribers.delete(conn);
  }

  subscribeState(conn: Connection): void {
    this.stateSubscribers.add(conn);
    this.trackConnect(conn);
    const msg = stateSnapshot(this.actorName, this.actorId, this.state);
    conn.send(JSON.stringify(msg));
  }

  unsubscribeState(conn: Connection): void {
    this.stateSubscribers.delete(conn);
  }

  removeConnection(conn: Connection): void {
    const wasKnown = this.knownConnections.delete(conn.id);
    this.eventSubscribers.delete(conn);
    this.stateSubscribers.delete(conn);
    if (wasKnown) {
      this.invokeLifecycle("onDisconnect", conn.id);
    }
  }

  // -----------------------------------------------------------------------
  // Connection lifecycle hooks
  // -----------------------------------------------------------------------

  trackConnect(conn: Connection): void {
    if (this.knownConnections.has(conn.id)) return;
    this.knownConnections.add(conn.id);
    this.invokeLifecycle("onConnect", conn.id);
  }

  private invokeLifecycle(hook: "onConnect" | "onDisconnect", connectionId: string): void {
    const handler = this.def.config[hook];
    if (!handler) return;

    this.queue.push({
      run: async () => {
        const pendingEvents: { event: string; payload: unknown }[] = [];
        const emit = (eventName: string, payload: unknown) => {
          pendingEvents.push({ event: eventName, payload });
        };

        const draft = createDraft(this.state as any);

        let result: unknown = handler({ state: draft, connectionId, emit });
        if (result instanceof Promise) await result;

        let patches: Patch[] = [];
        const nextState = finishDraft(draft, (p: Patch[], _inverse: Patch[]) => {
          patches = p;
        });

        this.state = nextState as any;

        if (patches.length > 0 && this.stateSubscribers.size > 0) {
          const patchMsg = statePatch(this.actorName, this.actorId, toJsonPatch(patches));
          const raw = JSON.stringify(patchMsg);
          for (const c of this.stateSubscribers) c.send(raw);
        }

        for (const pe of pendingEvents) {
          if (this.def.config.events?.[pe.event]) {
            const schema = this.def.config.events[pe.event] as StandardSchemaV1;
            const validation = await schema["~standard"].validate(pe.payload);
            if (validation.issues) continue;
            const msg = eventMsg(this.actorName, this.actorId, pe.event, validation.value);
            const raw = JSON.stringify(msg);
            for (const c of this.eventSubscribers) c.send(raw);
          }
        }
      },
    });
    this.drain();
  }

  // -----------------------------------------------------------------------
  // Method invocation (queued — single writer)
  // -----------------------------------------------------------------------

  invoke(method: string, input: unknown, conn: Connection): Promise<unknown> {
    this.trackConnect(conn);
    return new Promise((resolve, reject) => {
      this.queue.push({
        run: async () => {
          try {
            const result = await this.executeMethod(method, input, conn.id);
            resolve(result);
          } catch (err) {
            reject(err);
          }
        },
      });
      this.drain();
    });
  }

  private async drain(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      await item.run();
    }
    this.processing = false;
  }

  private async executeMethod(method: string, rawInput: unknown, connectionId: string): Promise<unknown> {
    const methodDef = this.def.config.methods[method];
    if (!methodDef) {
      throw new Error(`Unknown method: ${method}`);
    }

    let validatedInput: unknown = undefined;
    if (methodDef.input) {
      const schema = methodDef.input as StandardSchemaV1;
      const result = await schema["~standard"].validate(rawInput);
      if (result.issues) {
        throw new Error(
          `Validation failed for ${method}: ${JSON.stringify(result.issues)}`,
        );
      }
      validatedInput = result.value;
    }

    // Execute middleware chain
    const middlewares: Array<(args: any) => any> = (this.def.config as any)._middlewares ?? [];
    let ctx: Record<string, unknown> = {};

    for (const mw of middlewares) {
      const added = await mw({
        ctx,
        connectionId,
        actor: this.actorName,
        actorId: this.actorId,
        method,
      });
      if (added && typeof added === "object") {
        ctx = Object.assign(ctx, added);
      }
    }

    const pendingEvents: { event: string; payload: unknown }[] = [];
    const emit = (eventName: string, payload: unknown) => {
      pendingEvents.push({ event: eventName, payload });
    };

    // Use createDraft/finishDraft instead of produce so we can await async
    // handlers and clone the return value BEFORE the draft is finalized/revoked.
    const draft = createDraft(this.state as any);

    let returnValue: unknown = methodDef.handler({
      state: draft,
      input: validatedInput,
      emit,
      connectionId,
      ctx,
    });

    if (returnValue instanceof Promise) {
      returnValue = await returnValue;
    }

    // Clone the return value while the draft is still alive — this handles
    // cases where the handler returns `state.messages` (a draft proxy).
    if (returnValue !== undefined && returnValue !== null && typeof returnValue === "object") {
      returnValue = JSON.parse(JSON.stringify(returnValue));
    }

    let patches: Patch[] = [];
    const nextState = finishDraft(draft, (p: Patch[], _inverse: Patch[]) => {
      patches = p;
    });

    this.state = nextState as any;

    if (patches.length > 0 && this.stateSubscribers.size > 0) {
      const patchMsg = statePatch(
        this.actorName,
        this.actorId,
        toJsonPatch(patches),
      );
      const raw = JSON.stringify(patchMsg);
      for (const conn of this.stateSubscribers) {
        conn.send(raw);
      }
    }

    for (const pe of pendingEvents) {
      if (this.def.config.events?.[pe.event]) {
        const schema = this.def.config.events[pe.event] as StandardSchemaV1;
        const validation = await schema["~standard"].validate(pe.payload);
        if (validation.issues) continue;

        const msg = eventMsg(this.actorName, this.actorId, pe.event, validation.value);
        const raw = JSON.stringify(msg);
        for (const conn of this.eventSubscribers) {
          conn.send(raw);
        }
      }
    }

    return returnValue;
  }
}

// ---------------------------------------------------------------------------
// Manager events
// ---------------------------------------------------------------------------

export type ManagerEvent = "actorCreated" | "actorDestroyed";

export interface ActorInfo {
  actorName: string;
  actorId: string;
}

// ---------------------------------------------------------------------------
// ActorManager — owns all actor instances for this process
// ---------------------------------------------------------------------------

export class ActorManager {
  private instances = new Map<string, ActorInstance>();
  private creating = new Map<string, Promise<ActorInstance>>();
  private actors: Record<string, ActorDef<any, any, any>>;
  private listeners = new Map<ManagerEvent, Set<(info: ActorInfo) => void>>();

  constructor(actors: Record<string, ActorDef<any, any, any>>) {
    this.actors = actors;
  }

  // -----------------------------------------------------------------------
  // Events
  // -----------------------------------------------------------------------

  on(event: ManagerEvent, cb: (info: ActorInfo) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(cb);
    return () => set!.delete(cb);
  }

  private emit(event: ManagerEvent, info: ActorInfo): void {
    const set = this.listeners.get(event);
    if (set) for (const cb of set) cb(info);
  }

  // -----------------------------------------------------------------------
  // Instance management
  // -----------------------------------------------------------------------

  private key(actorName: string, actorId: string): string {
    return `${actorName}:${actorId}`;
  }

  async getOrCreate(actorName: string, actorId: string): Promise<ActorInstance> {
    const k = this.key(actorName, actorId);
    let instance = this.instances.get(k);
    if (instance) return instance;
    const pending = this.creating.get(k);
    if (pending) return pending;

    const creation = (async () => {
      const def = this.actors[actorName];
      if (!def) {
        throw new Error(`Unknown actor: ${actorName}`);
      }

      const stateSchema = def.config.state as StandardSchemaV1;

      // Try empty object first (works with z.object({ field: z.x().default(...) })),
      // then fall back to undefined (works with schemas that have a top-level .default()).
      let initialState: unknown;
      const fromObj = await stateSchema["~standard"].validate({});
      if (!fromObj.issues) {
        initialState = fromObj.value;
      } else {
        const fromUndef = await stateSchema["~standard"].validate(undefined);
        if (!fromUndef.issues) {
          initialState = fromUndef.value;
        } else {
          initialState = {};
        }
      }

      const existing = this.instances.get(k);
      if (existing) return existing;

      const created = new ActorInstance(actorName, actorId, def, initialState);
      this.instances.set(k, created);
      created.activate();
      this.emit("actorCreated", { actorName, actorId });
      return created;
    })();

    this.creating.set(k, creation);
    try {
      instance = await creation;
      return instance;
    } finally {
      this.creating.delete(k);
    }
  }

  /** Destroy a specific actor instance. Calls onDeactivate if defined. */
  async destroy(actorName: string, actorId: string): Promise<boolean> {
    const k = this.key(actorName, actorId);
    const instance = this.instances.get(k);
    if (!instance) return false;
    await instance.deactivate();
    this.instances.delete(k);
    this.emit("actorDestroyed", { actorName, actorId });
    return true;
  }

  /** Destroy all actor instances. */
  async destroyAll(): Promise<void> {
    const entries = [...this.instances.entries()];
    await Promise.all(entries.map(([, instance]) => instance.deactivate()));
    for (const [k, instance] of entries) {
      this.instances.delete(k);
      this.emit("actorDestroyed", { actorName: instance.actorName, actorId: instance.actorId });
    }
  }

  removeConnection(conn: Connection): void {
    for (const instance of this.instances.values()) {
      instance.removeConnection(conn);
    }
  }

  /** Number of hot actor instances. */
  get size(): number {
    return this.instances.size;
  }

  /** List all hot actor instances. */
  list(): ActorInfo[] {
    return [...this.instances.values()].map((i) => ({
      actorName: i.actorName,
      actorId: i.actorId,
    }));
  }
}
