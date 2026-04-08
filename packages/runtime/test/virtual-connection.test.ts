import { describe, test, expect } from "bun:test";
import { decode, outboundSubject } from "../../nats-transport/src/index";
import { VirtualConnection } from "../src/virtual-connection";

describe("VirtualConnection", () => {
  test("exposes auth metadata and publishes to the scoped outbound subject", () => {
    const published: Array<{ subject: string; data: Uint8Array }> = [];
    const js = {
      publish(subject: string, data: Uint8Array) {
        published.push({ subject, data });
      },
    };

    const conn = new VirtualConnection(
      "session-1",
      js as any,
      { workspaceId: "ws-1", projectId: "prj-1" },
      "user-123",
      { role: "admin" },
    );

    expect(conn.id).toBe("session-1");
    expect(conn.userId).toBe("user-123");
    expect(conn.claims).toEqual({ role: "admin" });
    expect(conn.scope).toEqual({ workspaceId: "ws-1", projectId: "prj-1" });

    conn.send(JSON.stringify({
      type: "rpc:result",
      id: "rpc-1",
      result: { ok: true },
    }));

    expect(published).toHaveLength(1);
    expect(published[0].subject).toBe(outboundSubject("ws-1", "prj-1", "session-1"));
    expect(decode(published[0].data)).toEqual({
      scope: { workspaceId: "ws-1", projectId: "prj-1" },
      sessionId: "session-1",
      message: {
        type: "rpc:result",
        id: "rpc-1",
        result: { ok: true },
      },
    });
  });
});
