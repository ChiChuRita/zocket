/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

const win = new Window();
const props = ["document", "window", "navigator", "HTMLElement", "Element", "Node", "Event", "CustomEvent", "MouseEvent", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"];
for (const p of props) {
  (globalThis as any)[p] = (win as any)[p];
}
(globalThis as any).window = win;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { StrictMode, createElement, useEffect, useState } from "react";
import { act, render, cleanup } from "@testing-library/react";
import { createZocketReact } from "../src/factory";

// ---------------------------------------------------------------------------
// Mock client that simulates the ref-counted handle semantics of @zocket/client.
// ---------------------------------------------------------------------------

interface MockHandle {
  on: (event: string, cb: (payload: any) => void) => () => void;
  state: {
    subscribe: (listener: (state: any) => void) => () => void;
    getSnapshot: () => any;
  };
  meta: { name: string; id: string; dispose: () => void };
}

function createMockClient() {
  const handles = new Map<string, { refCount: number; disposed: boolean; listeners: Set<(s: any) => void>; state: any }>();
  const disposeCalls: string[] = [];
  const retainCalls: string[] = [];

  function getOrCreate(name: string, id: string): MockHandle {
    const key = `${name}:${id}`;
    let entry = handles.get(key);
    if (!entry) {
      entry = { refCount: 0, disposed: false, listeners: new Set(), state: { count: 0 } };
      handles.set(key, entry);
    }
    entry.refCount += 1;
    retainCalls.push(key);

    const dispose = () => {
      disposeCalls.push(key);
      const e = handles.get(key);
      if (!e) return;
      e.refCount -= 1;
      if (e.refCount <= 0) {
        setTimeout(() => {
          const cur = handles.get(key);
          if (!cur || cur.refCount !== 0) return;
          cur.disposed = true;
          handles.delete(key);
        }, 0);
      }
    };

    return {
      on: () => () => {},
      state: {
        subscribe: (listener) => {
          entry!.listeners.add(listener);
          return () => entry!.listeners.delete(listener);
        },
        getSnapshot: () => entry!.state,
      },
      meta: { name, id, dispose },
    };
  }

  const client = {
    room: (id: string) => getOrCreate("room", id),
    connection: {
      ready: Promise.resolve(),
      status: "connected" as const,
      clientId: "c1",
      subscribe: () => () => {},
      close: () => {},
    },
    on: () => () => {},
    _handles: handles,
    _disposeCalls: disposeCalls,
    _retainCalls: retainCalls,
    _setState: (id: string, state: any) => {
      const key = `room:${id}`;
      let entry = handles.get(key);
      if (!entry) {
        entry = { refCount: 0, disposed: false, listeners: new Set(), state };
        handles.set(key, entry);
      } else {
        entry.state = state;
      }
      for (const l of entry.listeners) l(state);
    },
  };

  return client;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Flush microtasks + the client's setTimeout(0) dispose timer.
async function flush() {
  await new Promise((r) => setTimeout(r, 10));
}

describe("createZocketReact", () => {
  afterEach(() => {
    cleanup();
  });

  test("Fix #1: useActor cleanup releases exactly once (not twice)", async () => {
    const client = createMockClient();
    const { ZocketProvider, useActor } = createZocketReact<any>();

    function Consumer() {
      useActor("room" as any, "r1");
      return null;
    }

    const { unmount } = render(
      createElement(ZocketProvider, { client: client as any, children: createElement(Consumer) }),
    );

    expect(client._retainCalls.filter((k) => k === "room:r1").length).toBe(1);
    expect(client._disposeCalls.filter((k) => k === "room:r1").length).toBe(0);

    unmount();
    expect(client._disposeCalls.filter((k) => k === "room:r1").length).toBe(1);
  });

  test("Fix #2: StrictMode remount does not leave handle disposed or refCount negative", async () => {
    const client = createMockClient();
    const { ZocketProvider, useActor } = createZocketReact<any>();

    let lastHandle: MockHandle | null = null;
    function Consumer() {
      const h = useActor("room" as any, "r1") as unknown as MockHandle;
      lastHandle = h;
      return null;
    }

    const { unmount } = render(
      createElement(StrictMode, {
        children: createElement(ZocketProvider, {
          client: client as any,
          children: createElement(Consumer),
        }),
      }),
    );

    await flush();

    // Handle entry should still exist and not be disposed.
    const entry = client._handles.get("room:r1");
    expect(entry).toBeDefined();
    expect(entry!.disposed).toBe(false);
    expect(entry!.refCount).toBeGreaterThan(0);

    unmount();
    await flush();

    // After real unmount, the handle should be fully cleaned up.
    const entryAfter = client._handles.get("room:r1");
    expect(entryAfter).toBeUndefined();
  });

  test("Fix #2b: changing actorId disposes old handle and creates new one", async () => {
    const client = createMockClient();
    const { ZocketProvider, useActor } = createZocketReact<any>();

    let setIdExternal: ((id: string) => void) | null = null;
    function Consumer() {
      const [id, setId] = useState("r1");
      setIdExternal = setId;
      useActor("room" as any, id);
      return null;
    }

    render(
      createElement(ZocketProvider, { client: client as any, children: createElement(Consumer) }),
    );

    expect(client._handles.has("room:r1")).toBe(true);
    expect(client._handles.has("room:r2")).toBe(false);

    act(() => {
      setIdExternal!("r2");
    });
    await flush();

    expect(client._handles.has("room:r1")).toBe(false); // old disposed
    expect(client._handles.has("room:r2")).toBe(true); // new alive
  });

  test("Fix #3: useActorState returns correct projection after selector swap with unchanged state", async () => {
    const client = createMockClient();
    const { ZocketProvider, useActor, useActorState } = createZocketReact<any>();

    client._setState("r1", { a: 1, b: 2 });

    const results: any[] = [];
    let swap: ((fn: (s: any) => any) => void) | null = null;

    function Consumer() {
      const handle = useActor("room" as any, "r1") as unknown as MockHandle;
      const [sel, setSel] = useState<() => (s: any) => any>(() => (s: any) => s.a);
      swap = (fn) => setSel(() => fn);
      const value = useActorState(handle, sel);
      results.push(value);
      return null;
    }

    render(
      createElement(ZocketProvider, { client: client as any, children: createElement(Consumer) }),
    );

    expect(results.at(-1)).toBe(1);

    // Swap selector to read b, without changing underlying state.
    act(() => {
      swap!((s: any) => s.b);
    });

    expect(results.at(-1)).toBe(2);
  });

  test("useActorState re-renders on state change", () => {
    const client = createMockClient();
    const { ZocketProvider, useActor, useActorState } = createZocketReact<any>();

    client._setState("r1", { count: 0 });

    const seen: number[] = [];
    function Consumer() {
      const handle = useActor("room" as any, "r1") as unknown as MockHandle;
      const count = useActorState(handle, (s: any) => s.count);
      seen.push(count);
      return null;
    }

    render(
      createElement(ZocketProvider, { client: client as any, children: createElement(Consumer) }),
    );

    expect(seen.at(-1)).toBe(0);

    act(() => {
      client._setState("r1", { count: 5 });
    });

    expect(seen.at(-1)).toBe(5);
  });

  test("useClient throws without provider", () => {
    const { useClient } = createZocketReact<any>();
    function Consumer() {
      useClient();
      return null;
    }
    expect(() => render(createElement(Consumer))).toThrow(/ZocketProvider/);
  });
});
