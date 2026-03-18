import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createClient } from "../src/client";
import { MSG } from "../../core/src/protocol";

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  static instances: FakeWebSocket[] = [];

  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];

  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    if (this.readyState !== FakeWebSocket.OPEN) {
      throw new Error("Socket is not open");
    }
    this.sent.push(data);
  }

  close(_code?: number, reason?: string): void {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ reason } as CloseEvent);
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }

  fail(reason = "connection failed"): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.onerror?.(new Event("error"));
    this.onclose?.({ reason } as CloseEvent);
  }

  receive(message: unknown): void {
    this.onmessage?.({
      data: JSON.stringify(message),
    } as MessageEvent);
  }
}

function lastSocket(): FakeWebSocket {
  const socket = FakeWebSocket.instances.at(-1);
  if (!socket) throw new Error("Expected a WebSocket instance");
  return socket;
}

function parseSent(socket: FakeWebSocket): Array<Record<string, unknown>> {
  return socket.sent.map((raw) => JSON.parse(raw));
}

describe("createClient robustness", () => {
  const RealWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    FakeWebSocket.instances = [];
    (globalThis as any).WebSocket = FakeWebSocket;
  });

  afterEach(() => {
    (globalThis as any).WebSocket = RealWebSocket;
  });

  describe("Connection Lifecycle", () => {
    test("rejects $ready when the initial connection never comes up", async () => {
      const client = createClient<any>({
        url: "ws://test",
        connectTimeout: 25,
        reconnect: false,
      });

      lastSocket().fail();

      await expect(client.$ready).rejects.toThrow("did not connect within 25ms");
      client.$close();
    });

    test("does not send an RPC after it already timed out waiting for a socket", async () => {
      const client = createClient<any>({
        url: "ws://test",
        rpcTimeout: 25,
        connectTimeout: 0,
        reconnect: false,
      });

      const socket = lastSocket();
      const room = client.chat("room-1");

      await expect(room.sendMessage({ text: "late" })).rejects.toThrow(
        'WebSocket was not ready within 25ms',
      );

      expect(socket.sent).toHaveLength(0);

      socket.open();
      await client.$ready;

      expect(socket.sent).toHaveLength(0);
      client.$close();
    });

    test("replays active subscriptions after reconnect", async () => {
      const client = createClient<any>({
        url: "ws://test",
        connectTimeout: 0,
        reconnectDelayMs: 0,
      });

      const first = lastSocket();
      first.open();
      await client.$ready;

      const room = client.chat("room-reconnect");
      const offEvent = room.on("message", () => {});
      const offState = room.state.subscribe(() => {});

      expect(parseSent(first)).toEqual([
        { type: MSG.EVENT_SUB, actor: "chat", actorId: "room-reconnect" },
        { type: MSG.STATE_SUB, actor: "chat", actorId: "room-reconnect" },
      ]);

      first.close(undefined, "dropped");
      await new Promise((resolve) => setTimeout(resolve, 0));

      const second = lastSocket();
      expect(second).not.toBe(first);

      second.open();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(parseSent(second)).toEqual([
        { type: MSG.EVENT_SUB, actor: "chat", actorId: "room-reconnect" },
        { type: MSG.STATE_SUB, actor: "chat", actorId: "room-reconnect" },
      ]);

      offEvent();
      offState();
      client.$close();
    });

    test("waits for reconnect before sending a new RPC", async () => {
      const client = createClient<any>({
        url: "ws://test",
        connectTimeout: 0,
        reconnectDelayMs: 0,
        rpcTimeout: 100,
      });

      const first = lastSocket();
      first.open();
      await client.$ready;

      first.close(undefined, "network drop");
      await new Promise((resolve) => setTimeout(resolve, 0));

      const second = lastSocket();
      const rpc = client.chat("room-rpc").sendMessage({ text: "after reconnect" });

      expect(second.sent).toHaveLength(0);

      second.open();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const outbound = parseSent(second);
      expect(outbound).toHaveLength(1);
      expect(outbound[0]).toMatchObject({
        type: MSG.RPC,
        actor: "chat",
        actorId: "room-rpc",
        method: "sendMessage",
        input: { text: "after reconnect" },
      });

      const rpcId = outbound[0].id as string;
      second.receive({
        type: MSG.RPC_RESULT,
        id: rpcId,
        result: { ok: true },
      });

      await expect(rpc).resolves.toEqual({ ok: true });
      client.$close();
    });

    test("rejects in-flight RPCs when the socket drops", async () => {
      const client = createClient<any>({
        url: "ws://test",
        connectTimeout: 0,
        reconnectDelayMs: 0,
        rpcTimeout: 100,
      });

      const socket = lastSocket();
      socket.open();
      await client.$ready;

      const rpc = client.chat("room-close").sendMessage({ text: "bye" });
      await Promise.resolve();
      expect(parseSent(socket)[0]).toMatchObject({
        type: MSG.RPC,
        actor: "chat",
        actorId: "room-close",
        method: "sendMessage",
      });

      socket.close(undefined, "server restart");

      await expect(rpc).rejects.toThrow("server restart");
      client.$close();
    });

    test("does not resubscribe a disposed handle after reconnect", async () => {
      const client = createClient<any>({
        url: "ws://test",
        connectTimeout: 0,
        reconnectDelayMs: 0,
      });

      const first = lastSocket();
      first.open();
      await client.$ready;

      const room = client.chat("room-disposed");
      const off = room.on("message", () => {});
      expect(parseSent(first)).toEqual([
        { type: MSG.EVENT_SUB, actor: "chat", actorId: "room-disposed" },
      ]);

      first.close(undefined, "drop");
      room.$dispose();
      off();

      await new Promise((resolve) => setTimeout(resolve, 0));
      const second = lastSocket();
      second.open();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(second.sent).toHaveLength(0);
      client.$close();
    });
  });

  describe("RPC Correlation", () => {
    test("matches concurrent RPC results by id even when responses arrive out of order", async () => {
      const client = createClient<any>({
        url: "ws://test",
        connectTimeout: 0,
      });

      const socket = lastSocket();
      socket.open();
      await client.$ready;

      const room = client.chat("room-concurrent");
      const first = room.sendMessage({ text: "first" });
      const second = room.sendMessage({ text: "second" });
      await Promise.resolve();

      const [firstMsg, secondMsg] = parseSent(socket);
      expect(firstMsg).toMatchObject({
        type: MSG.RPC,
        method: "sendMessage",
        input: { text: "first" },
      });
      expect(secondMsg).toMatchObject({
        type: MSG.RPC,
        method: "sendMessage",
        input: { text: "second" },
      });

      socket.receive({
        type: MSG.RPC_RESULT,
        id: secondMsg.id,
        result: { which: "second" },
      });
      socket.receive({
        type: MSG.RPC_RESULT,
        id: firstMsg.id,
        result: { which: "first" },
      });

      await expect(first).resolves.toEqual({ which: "first" });
      await expect(second).resolves.toEqual({ which: "second" });
      client.$close();
    });

    test("ignores unknown and late RPC responses", async () => {
      const client = createClient<any>({
        url: "ws://test",
        connectTimeout: 0,
        rpcTimeout: 30,
      });

      const socket = lastSocket();
      socket.open();
      await client.$ready;

      socket.receive({
        type: MSG.RPC_RESULT,
        id: "rpc_unknown",
        result: { ignored: true },
      });

      const timedOut = client.chat("room-late").sendMessage({ text: "late" });
      await Promise.resolve();

      const [sent] = parseSent(socket);
      expect(sent).toMatchObject({
        type: MSG.RPC,
        actorId: "room-late",
        method: "sendMessage",
      });

      await expect(timedOut).rejects.toThrow('RPC "sendMessage" timed out after 30ms');

      socket.receive({
        type: MSG.RPC_RESULT,
        id: sent.id,
        result: { tooLate: true },
      });

      const next = client.chat("room-late").getMessages();
      await Promise.resolve();
      const [, nextSent] = parseSent(socket);

      socket.receive({
        type: MSG.RPC_RESULT,
        id: nextSent.id,
        result: [{ ok: true }],
      });

      await expect(next).resolves.toEqual([{ ok: true }]);
      client.$close();
    });
  });
});
