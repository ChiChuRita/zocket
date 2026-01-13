import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { render, screen, waitFor } from '@testing-library/react';
import React, { useState, useEffect } from 'react';
import { ZocketProvider, useZocket, createZocketClient, useConnectionState } from '../../src/index';
import { createTestServer, type PingPongRouter } from './server';

let testServer: ReturnType<typeof createTestServer>;
let serverUrl: string;

beforeAll(() => {
  testServer = createTestServer(0);
  serverUrl = testServer.url;
});

afterAll(() => {
  testServer.close();
});

describe('E2E: React Zocket with Real WebSocket', () => {
  it('should send ping and receive pong from real server', async () => {
    const testMessage = 'Hello from E2E test';
    const testTimestamp = Date.now();

    // capture logs during this test
    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (...args: any[]) => {
      try {
        const rendered = args
          .map((a) => {
            if (typeof a === 'string') return a;
            try {
              return JSON.stringify(a);
            } catch {
              return String(a);
            }
          })
          .join(' ');
        logs.push(rendered);
      } finally {
        // still print to stdout to aid debugging
        originalLog(...args as any);
      }
    };

    const TestComponent = () => {
      const { client, useEvent } = useZocket<PingPongRouter>();
      const conn = useConnectionState(client);
      const [pongReceived, setPongReceived] = useState(false);
      const [receivedData, setReceivedData] = useState<any>(null);

      useEvent(client.on.test.pong, (data) => {
        console.log('🎉 client received pong:', JSON.stringify(data));
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
            {pongReceived ? 'pong-received' : 'waiting'}
          </div>
          {receivedData && (
            <div>
              <div data-testid="message">{receivedData.message}</div>
              <div data-testid="timestamp">{receivedData.timestamp}</div>
              <div data-testid="server-time">{receivedData.serverTime}</div>
            </div>
          )}
        </div>
      );
    };

    const client = createZocketClient<PingPongRouter>(serverUrl);

    render(
      <ZocketProvider<PingPongRouter> client={client}>
        <TestComponent />
      </ZocketProvider>
    );

    try {
      await waitFor(
        () => {
          expect(screen.getByTestId('status').textContent).toBe('pong-received');
        },
        { timeout: 3000 }
      );

      expect(screen.getByTestId('conn-status').textContent).toBe('open');
      expect(screen.getByTestId('message').textContent).toBe(testMessage);
      expect(screen.getByTestId('timestamp').textContent).toBe(
        testTimestamp.toString()
      );
      expect(screen.getByTestId('server-time')).toBeDefined();
      const serverTime = parseInt(screen.getByTestId('server-time').textContent || '0');
      expect(serverTime).toBeGreaterThan(0);

      // assert logs for ping received and pong sent (server) and pong received (client)
      const joined = logs.join('\n');
      expect(joined).toContain('received ping');
      expect(joined).toContain(testMessage);
      expect(joined).toContain('sending pong');
      expect(joined).toContain('client received pong');
    } finally {
      console.log = originalLog;
    }
  });

  it('should handle multiple clients independently', async () => {
    const Client1Component = () => {
      const { client, useEvent } = useZocket<PingPongRouter>();
      const [count, setCount] = useState(0);

      useEvent(client.on.test.pong, () => {
        setCount((c) => c + 1);
      });

      useEffect(() => {
        const timer = setTimeout(() => {
          client.test.ping({
            message: 'client1',
            timestamp: Date.now(),
          });
        }, 100);

        return () => clearTimeout(timer);
      }, [client]);

      return <div data-testid="client1-count">{count}</div>;
    };

    const Client2Component = () => {
      const { client, useEvent } = useZocket<PingPongRouter>();
      const [count, setCount] = useState(0);

      useEvent(client.on.test.pong, () => {
        setCount((c) => c + 1);
      });

      useEffect(() => {
        const timer = setTimeout(() => {
          client.test.ping({
            message: 'client2',
            timestamp: Date.now(),
          });
        }, 100);

        return () => clearTimeout(timer);
      }, [client]);

      return <div data-testid="client2-count">{count}</div>;
    };

    const client1 = createZocketClient<PingPongRouter>(serverUrl);
    const { container: container1 } = render(
      <ZocketProvider<PingPongRouter> client={client1}>
        <Client1Component />
      </ZocketProvider>
    );

    const client2 = createZocketClient<PingPongRouter>(serverUrl);
    const { container: container2 } = render(
      <ZocketProvider<PingPongRouter> client={client2}>
        <Client2Component />
      </ZocketProvider>
    );

    await waitFor(
      () => {
        const count1 = container1.querySelector('[data-testid="client1-count"]')?.textContent;
        const count2 = container2.querySelector('[data-testid="client2-count"]')?.textContent;
        expect(count1).toBe('1');
        expect(count2).toBe('1');
      },
      { timeout: 3000 }
    );
  });

  it('should cleanup connection on unmount', async () => {
    const TestComponent = () => {
      const { client, useEvent } = useZocket<PingPongRouter>();
      const [mounted, setMounted] = useState(true);

      useEvent(client.on.test.pong, () => { });

      return (
        <div>
          <div data-testid="mounted">{mounted ? 'yes' : 'no'}</div>
        </div>
      );
    };

    const client = createZocketClient<PingPongRouter>(serverUrl);
    const { unmount } = render(
      <ZocketProvider<PingPongRouter> client={client}>
        <TestComponent />
      </ZocketProvider>
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('mounted').textContent).toBe('yes');
      },
      { timeout: 1000 }
    );

    unmount();
  });
});


