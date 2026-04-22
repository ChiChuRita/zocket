import type {
  RpcCallMessage,
  RpcResultMessage,
  EventMessage,
  EventSubMessage,
  EventUnsubMessage,
  StateSubMessage,
  StateUnsubMessage,
  StateSnapshotMessage,
  StatePatchMessage,
  WelcomeMessage,
  JsonPatchOp,
  ClientMessage,
  ServerMessage,
} from "./types";

// ---------------------------------------------------------------------------
// Message type constants
// ---------------------------------------------------------------------------

export const MSG = {
  RPC: "rpc",
  RPC_RESULT: "rpc:result",
  EVENT: "event",
  EVENT_SUB: "event:sub",
  EVENT_UNSUB: "event:unsub",
  STATE_SUB: "state:sub",
  STATE_UNSUB: "state:unsub",
  STATE_SNAPSHOT: "state:snapshot",
  STATE_PATCH: "state:patch",
  WELCOME: "welcome",
} as const;

// ---------------------------------------------------------------------------
// Builders — thin helpers that guarantee shape correctness
// ---------------------------------------------------------------------------

let _rpcIdCounter = 0;

export function rpcId(): string {
  return `rpc_${++_rpcIdCounter}_${Date.now().toString(36)}`;
}

export function rpcCall(
  actor: string,
  actorId: string,
  method: string,
  input?: unknown,
): RpcCallMessage {
  return { type: MSG.RPC, id: rpcId(), actor, actorId, method, input };
}

export function rpcResult(
  id: string,
  result?: unknown,
  error?: string,
): RpcResultMessage {
  return { type: MSG.RPC_RESULT, id, result, error };
}

export function event(
  actor: string,
  actorId: string,
  eventName: string,
  payload: unknown,
): EventMessage {
  return { type: MSG.EVENT, actor, actorId, event: eventName, payload };
}

export function eventSub(actor: string, actorId: string): EventSubMessage {
  return { type: MSG.EVENT_SUB, actor, actorId };
}

export function eventUnsub(actor: string, actorId: string): EventUnsubMessage {
  return { type: MSG.EVENT_UNSUB, actor, actorId };
}

export function stateSub(actor: string, actorId: string): StateSubMessage {
  return { type: MSG.STATE_SUB, actor, actorId };
}

export function stateUnsub(actor: string, actorId: string): StateUnsubMessage {
  return { type: MSG.STATE_UNSUB, actor, actorId };
}

export function stateSnapshot(
  actor: string,
  actorId: string,
  state: unknown,
): StateSnapshotMessage {
  return { type: MSG.STATE_SNAPSHOT, actor, actorId, state };
}

export function statePatch(
  actor: string,
  actorId: string,
  patches: JsonPatchOp[],
): StatePatchMessage {
  return { type: MSG.STATE_PATCH, actor, actorId, patches };
}

export function welcome(clientId: string): WelcomeMessage {
  return { type: MSG.WELCOME, clientId };
}

// ---------------------------------------------------------------------------
// Parse helpers
// ---------------------------------------------------------------------------

export function parseMessage(raw: string): ClientMessage | ServerMessage | null {
  try {
    const msg = JSON.parse(raw);
    if (typeof msg === "object" && msg !== null && typeof msg.type === "string") {
      return msg as ClientMessage | ServerMessage;
    }
    return null;
  } catch {
    return null;
  }
}
