import type { JsonPatchOp, Unsubscribe } from "@zocket/core/types";

/**
 * Client-side state store for a single actor handle.
 * Receives snapshots and patches from the server, notifies subscribers.
 */
export class StateStore<TState> {
  private state: TState | undefined = undefined;
  private listeners = new Set<(state: TState) => void>();

  getState(): TState | undefined {
    return this.state;
  }

  /** Replace state entirely (used on initial snapshot) */
  setSnapshot(state: TState): void {
    this.state = state;
    this.notify();
  }

  /** Apply JSON Patches (RFC 6902) incrementally */
  applyPatches(patches: JsonPatchOp[]): void {
    if (this.state === undefined) return;

    let current: any = structuredClone(this.state);
    for (const patch of patches) {
      current = applyPatch(current, patch);
    }
    this.state = current as TState;
    this.notify();
  }

  subscribe(listener: (state: TState) => void): Unsubscribe {
    this.listeners.add(listener);
    if (this.state !== undefined) {
      listener(this.state);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  get subscriberCount(): number {
    return this.listeners.size;
  }

  clear(): void {
    this.state = undefined;
    this.listeners.clear();
  }

  private notify(): void {
    if (this.state === undefined) return;
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

// ---------------------------------------------------------------------------
// Minimal JSON Patch applier (RFC 6902 subset: add, remove, replace)
// ---------------------------------------------------------------------------

function applyPatch(obj: any, patch: JsonPatchOp): any {
  const segments = parsePath(patch.path);

  switch (patch.op) {
    case "add":
    case "replace":
      return setAtPath(obj, segments, patch.value);
    case "remove":
      return removeAtPath(obj, segments);
    default:
      return obj;
  }
}

function parsePath(path: string): string[] {
  if (path === "" || path === "/") return [];
  const parts = path.split("/");
  // First element is empty because path starts with /
  return parts.slice(1).map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function setAtPath(obj: any, segments: string[], value: unknown): any {
  if (segments.length === 0) return value;

  const [head, ...rest] = segments;
  const isArr = Array.isArray(obj);
  const key = isArr ? (head === "-" ? obj.length : Number(head)) : head;

  if (rest.length === 0) {
    if (isArr) {
      const clone = [...obj];
      if (head === "-") {
        clone.push(value);
      } else {
        clone[key as number] = value;
      }
      return clone;
    }
    return { ...obj, [key]: value };
  }

  const child = obj?.[key as any];
  const updated = setAtPath(child, rest, value);
  if (isArr) {
    const clone = [...obj];
    clone[key as number] = updated;
    return clone;
  }
  return { ...obj, [key]: updated };
}

function removeAtPath(obj: any, segments: string[]): any {
  if (segments.length === 0) return undefined;

  const [head, ...rest] = segments;
  const isArr = Array.isArray(obj);
  const key = isArr ? Number(head) : head;

  if (rest.length === 0) {
    if (isArr) {
      const clone = [...obj];
      clone.splice(key as number, 1);
      return clone;
    }
    const { [key as string]: _, ...rest2 } = obj;
    return rest2;
  }

  const child = obj?.[key as any];
  const updated = removeAtPath(child, rest);
  if (isArr) {
    const clone = [...obj];
    clone[key as number] = updated;
    return clone;
  }
  return { ...obj, [key]: updated };
}
