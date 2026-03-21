import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import React, { useState, useEffect } from "react";
import {
  createZocketReact,
  createZocketClient,
  useConnectionState,
  useEvent,
} from "../../src/index";
import { createTestServer, type PingPongRouter } from "./server";

let testServer: ReturnType<typeof createTestServer>;
let serverUrl: string;

beforeAll(() => {
  testServer = createTestServer(0);
  serverUrl = testServer.url;
});

afterAll(() => {
  testServer.close();
});

// ============================================================================
// Factory API Tests
// ============================================================================

describe("E2E: createZocketReact Factory API", () => {
  // Create typed hooks using the factory pattern
  const zocket = createZocketReact<PingPongRouter>();

  it("should work with factory pattern - send ping receive pong", async () => {
    const testMessage = "Factory pattern test";
    const testTimestamp = Date.now();

    const TestComponent = () => {
      const client = zocket.useClient();
      const conn = zocket.useConnectionState();
      const [pongReceived, setPongReceived] = useState(false);
      const [receivedData, setReceivedData] = useState<any>(null);

      zocket.useEvent(client.on.test.pong, (data) => {
        setReceivedData(data);
        setPongReceived(true);
      });

      useEffect(() => {
        const timer = setTimeout(() => {
          client.test.ping({
            message: testMessage,
            timestamp: testTimestamp,
          });
        }, 100);

        return () => clearTimeout(timer);
      }, [client]);

      return (
        <div>
          <div data-testid="conn-status">{conn.status}</div>
          <div data-testid="status">
            {pongReceived ? "pong-received" : "waiting"}
          </div>
          {receivedData && (
            <div>
              <div data-testid="message">{receivedData.message}</div>
              <div data-testid="timestamp">{receivedData.timestamp}</div>
            </div>
          )}
        </div>
      );
    };

    const client = createZocketClient<PingPongRouter>(serverUrl);

    render(
      <zocket.ZocketProvider client={client}>
        <TestComponent />
      </zocket.ZocketProvider>
    );

    await waitFor(
      () => {
        expect(screen.getByTestId("status").textContent).toBe("pong-received");
      },
      { timeout: 3000 }
    );

    expect(screen.getByTestId("conn-status").textContent).toBe("open");
    expect(screen.getByTestId("message").textContent).toBe(testMessage);
    expect(screen.getByTestId("timestamp").textContent).toBe(
      testTimestamp.toString()
    );
  });
});

// ============================================================================
// Standalone Hooks Tests
// ============================================================================

describe("E2E: Standalone Hooks", () => {
  it("should work with standalone hooks (manually passing client)", async () => {
    const TestComponent = ({ client }: { client: any }) => {
      const [received, setReceived] = useState(false);
      const conn = useConnectionState(client);

      useEvent(client.on.test.pong, () => {
        setReceived(true);
      });

      useEffect(() => {
        if (conn.status === "open") {
          client.test.ping({ message: "standalone", timestamp: Date.now() });
        }
      }, [conn.status]);

      return (
        <div>
          <div data-testid="conn-status">{conn.status}</div>
          <div data-testid="received">{received ? "yes" : "no"}</div>
        </div>
      );
    };

    const client = createZocketClient<PingPongRouter>(serverUrl);

    render(<TestComponent client={client} />);

    await waitFor(
      () => {
        expect(screen.getByTestId("received").textContent).toBe("yes");
      },
      { timeout: 3000 }
    );
  });
});
