import type {
  RpcCallMessage,
  Unsubscribe,
  ServerMessage,
  StateSnapshotMessage,
  StatePatchMessage,
} from "@zocket/core/types";
import {
  rpcCall,
  eventSub,
  eventUnsub,
  stateSub,
  stateUnsub,
  MSG,
} from "@zocket/core/protocol";
import { StateStore } from "./state-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SendFn = (raw: string) => void;
export type RpcSendFn = (msg: RpcCallMessage) => Promise<unknown>;

// ---------------------------------------------------------------------------
// ActorHandleImpl — one per (actorName, actorId) pair
// ---------------------------------------------------------------------------

export class ActorHandleImpl {
  readonly actorName: string;
  readonly actorId: string;

  private wsSend: SendFn;
  private rpcSend: RpcSendFn;
  private eventListeners = new Map<string, Set<(payload: unknown) => void>>();
  private stateStore = new StateStore<unknown>();
  private eventSubscribed = false;
  private stateSubscribed = false;
  private _refCount = 0;

  constructor(
    actorName: string,
    actorId: string,
    wsSend: SendFn,
    rpcSend: RpcSendFn,
  ) {
    this.actorName = actorName;
    this.actorId = actorId;
    this.wsSend = wsSend;
    this.rpcSend = rpcSend;
  }

  /** Call a method on the actor. Returns a promise with the result. */
  call(method: string, input?: unknown): Promise<unknown> {
    const msg = rpcCall(this.actorName, this.actorId, method, input);
    return this.rpcSend(msg);
  }

  /** Subscribe to an event. Returns an unsubscribe function. */
  on(event: string, callback: (payload: unknown) => void): Unsubscribe {
    if (!this.eventSubscribed) {
      this.eventSubscribed = true;
      this.wsSend(JSON.stringify(eventSub(this.actorName, this.actorId)));
    }
    let set = this.eventListeners.get(event);
    if (!set) {
      set = new Set();
      this.eventListeners.set(event, set);
    }
    set.add(callback);
    return () => {
      set!.delete(callback);
      if (set!.size === 0) this.eventListeners.delete(event);
      if (this.totalEventListeners === 0 && this.eventSubscribed) {
        this.eventSubscribed = false;
        this.wsSend(JSON.stringify(eventUnsub(this.actorName, this.actorId)));
      }
    };
  }

  private get totalEventListeners(): number {
    let count = 0;
    for (const set of this.eventListeners.values()) count += set.size;
    return count;
  }

  /** State subscription object */
  get state() {
    return {
      subscribe: (listener: (state: unknown) => void): Unsubscribe => {
        if (!this.stateSubscribed) {
          this.stateSubscribed = true;
          this.wsSend(JSON.stringify(stateSub(this.actorName, this.actorId)));
        }
        const unsub = this.stateStore.subscribe(listener);
        return () => {
          unsub();
          if (this.stateStore.subscriberCount === 0 && this.stateSubscribed) {
            this.stateSubscribed = false;
            this.wsSend(JSON.stringify(stateUnsub(this.actorName, this.actorId)));
          }
        };
      },
      getSnapshot: (): unknown => this.stateStore.getState(),
    };
  }

  /** Handle an incoming server message routed to this handle (events + state only) */
  handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case MSG.EVENT: {
        const listeners = this.eventListeners.get(msg.event);
        if (listeners) {
          for (const cb of listeners) cb(msg.payload);
        }
        break;
      }
      case MSG.STATE_SNAPSHOT: {
        this.stateStore.setSnapshot((msg as StateSnapshotMessage).state);
        break;
      }
      case MSG.STATE_PATCH: {
        this.stateStore.applyPatches((msg as StatePatchMessage).patches);
        break;
      }
    }
  }

  retain(): void {
    this._refCount++;
  }

  release(): number {
    return Math.max(0, --this._refCount);
  }

  get refCount(): number {
    return this._refCount;
  }

  syncSubscriptions(send: SendFn): void {
    if (this.eventSubscribed) {
      send(JSON.stringify(eventSub(this.actorName, this.actorId)));
    }
    if (this.stateSubscribed) {
      send(JSON.stringify(stateSub(this.actorName, this.actorId)));
    }
  }

  dispose(): void {
    if (this.eventSubscribed) {
      this.eventSubscribed = false;
      this.wsSend(JSON.stringify(eventUnsub(this.actorName, this.actorId)));
    }
    if (this.stateSubscribed) {
      this.stateSubscribed = false;
      this.wsSend(JSON.stringify(stateUnsub(this.actorName, this.actorId)));
    }
    this.eventListeners.clear();
    this.stateStore.clear();
  }
}
