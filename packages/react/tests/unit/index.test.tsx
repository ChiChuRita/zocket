import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { render, screen, waitFor, renderHook, act } from '@testing-library/react';
import React, { useState } from 'react';
import { ZocketProvider, useZocket } from '../../src/index';
import type { AnyRouter } from '@zocket/core';
import { z } from 'zod';

const mockClient = {
  send: {
    posts: {
      create: mock(() => { }),
    },
    users: {
      login: mock(() => { }),
    },
  },
  on: {
    posts: {
      created: mock((callback: (data: any) => void) => {
        return () => { };
      }),
    },
    users: {
      joined: mock((callback: (data: any) => void) => {
        return () => { };
      }),
    },
  },
  close: mock(() => { }),
} as any;

const mockCreateZocketClient = mock(() => mockClient);

mock.module('@zocket/core', () => ({
  createZocketClient: mockCreateZocketClient,
  AnyRouter: {} as any,
  ZocketClient: {} as any,
}));

type TestRouter = {
  posts: {
    create: {
      payload: z.ZodObject<{ title: z.ZodString }>;
      type: 'incoming';
    };
    created: {
      payload: z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
      }>;
      type: 'outgoing';
    };
  };
  users: {
    login: {
      payload: z.ZodObject<{ username: z.ZodString }>;
      type: 'incoming';
    };
    joined: {
      payload: z.ZodObject<{ name: z.ZodString }>;
      type: 'outgoing';
    };
  };
};

describe('ZocketProvider', () => {
  beforeEach(() => {
    mockCreateZocketClient.mockClear();
    mockClient.close.mockClear();
  });

  it('should create a client with the provided URL', () => {
    const url = 'ws://localhost:3000';
    render(
      <ZocketProvider<TestRouter> url={url}>
        <div>Test</div>
      </ZocketProvider>
    );

    expect(mockCreateZocketClient).toHaveBeenCalledWith(url, expect.any(Object));
  });

  it('should pass options to client creation', () => {
    const url = 'ws://localhost:3000';
    const options = {
      maxReconnectionDelay: 5000,
      minReconnectionDelay: 500,
      debug: true,
      headers: { Authorization: 'Bearer token' },
    };

    render(
      <ZocketProvider<TestRouter> url={url} {...options}>
        <div>Test</div>
      </ZocketProvider>
    );

    expect(mockCreateZocketClient).toHaveBeenCalledWith(
      url,
      expect.objectContaining(options)
    );
  });

  it('should call onOpen callback when provided', () => {
    const onOpen = mock(() => { });
    render(
      <ZocketProvider<TestRouter> url="ws://localhost:3000" onOpen={onOpen}>
        <div>Test</div>
      </ZocketProvider>
    );

    expect(mockCreateZocketClient).toHaveBeenCalledWith(
      'ws://localhost:3000',
      expect.objectContaining({ onOpen })
    );
  });

  it('should call onClose callback when provided', () => {
    const onClose = mock(() => { });
    render(
      <ZocketProvider<TestRouter> url="ws://localhost:3000" onClose={onClose}>
        <div>Test</div>
      </ZocketProvider>
    );

    expect(mockCreateZocketClient).toHaveBeenCalledWith(
      'ws://localhost:3000',
      expect.objectContaining({ onClose })
    );
  });

  it('should close client on unmount', () => {
    const { unmount } = render(
      <ZocketProvider<TestRouter> url="ws://localhost:3000">
        <div>Test</div>
      </ZocketProvider>
    );

    unmount();
    expect(mockClient.close).toHaveBeenCalled();
  });

  it('should render children', () => {
    render(
      <ZocketProvider<TestRouter> url="ws://localhost:3000">
        <div data-testid="child">Test Content</div>
      </ZocketProvider>
    );

    expect(screen.getByTestId('child').textContent).toBe('Test Content');
  });
});

describe('useZocket', () => {
  beforeEach(() => {
    mockCreateZocketClient.mockClear();
    mockClient.close.mockClear();
  });

  it('should throw error when used outside provider', () => {
    const TestComponent = () => {
      useZocket<TestRouter>();
      return <div>Test</div>;
    };

    expect(() => render(<TestComponent />)).toThrow(
      'useZocket must be used within a ZocketProvider'
    );
  });

  it('should return client instance', () => {
    const TestComponent = () => {
      const { client } = useZocket<TestRouter>();
      expect(client).toBeDefined();
      expect(client.send).toBeDefined();
      expect(client.on).toBeDefined();
      return <div>Test</div>;
    };

    render(
      <ZocketProvider<TestRouter> url="ws://localhost:3000">
        <TestComponent />
      </ZocketProvider>
    );
  });

  it('should return useEvent hook', () => {
    const TestComponent = () => {
      const { useEvent } = useZocket<TestRouter>();
      expect(useEvent).toBeDefined();
      expect(typeof useEvent).toBe('function');
      return <div>Test</div>;
    };

    render(
      <ZocketProvider<TestRouter> url="ws://localhost:3000">
        <TestComponent />
      </ZocketProvider>
    );
  });
});

describe('useEvent', () => {
  let mockSubscribeFn: any;
  let mockUnsubscribe: any;

  beforeEach(() => {
    mockCreateZocketClient.mockClear();
    mockClient.close.mockClear();
    mockUnsubscribe = mock(() => { });
    mockSubscribeFn = mock((callback: (data: any) => void) => {
      return mockUnsubscribe;
    });
  });

  it('should subscribe to events on mount', () => {
    const TestComponent = () => {
      const { useEvent } = useZocket<TestRouter>();
      const handler = mock((data: any) => { });

      useEvent(mockSubscribeFn, handler);

      return <div>Test</div>;
    };

    render(
      <ZocketProvider<TestRouter> url="ws://localhost:3000">
        <TestComponent />
      </ZocketProvider>
    );

    expect(mockSubscribeFn).toHaveBeenCalled();
  });

  it('should unsubscribe on unmount', () => {
    const TestComponent = () => {
      const { useEvent } = useZocket<TestRouter>();
      const handler = mock((data: any) => { });

      useEvent(mockSubscribeFn, handler);

      return <div>Test</div>;
    };

    const { unmount } = render(
      <ZocketProvider<TestRouter> url="ws://localhost:3000">
        <TestComponent />
      </ZocketProvider>
    );

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should call handler when event is received', async () => {
    let eventCallback: ((data: any) => void) | null = null;

    const subscribeFn = (callback: (data: any) => void) => {
      eventCallback = callback;
      return () => { };
    };

    const handler = mock((data: any) => { });

    const TestComponent = () => {
      const { useEvent } = useZocket<TestRouter>();
      useEvent(subscribeFn, handler);
      return <div>Test</div>;
    };

    render(
      <ZocketProvider<TestRouter> url="ws://localhost:3000">
        <TestComponent />
      </ZocketProvider>
    );

    await waitFor(() => {
      expect(eventCallback).not.toBeNull();
    });

    const testData = { id: '1', title: 'Test' };
    act(() => {
      eventCallback!(testData);
    });

    await waitFor(() => {
      expect(handler).toHaveBeenCalledWith(testData);
    });
  });

  it('should update handler without resubscribing', async () => {
    let eventCallback: ((data: any) => void) | null = null;
    let subscribeCount = 0;

    const subscribeFn = (callback: (data: any) => void) => {
      subscribeCount++;
      eventCallback = callback;
      return () => { };
    };

    const TestComponent = () => {
      const { useEvent } = useZocket<TestRouter>();
      const [count, setCount] = useState(0);

      const handler = (data: any) => {
        setCount((c) => c + 1);
      };

      useEvent(subscribeFn, handler);

      return <div data-testid="count">{count}</div>;
    };

    const { rerender } = render(
      <ZocketProvider<TestRouter> url="ws://localhost:3000">
        <TestComponent />
      </ZocketProvider>
    );

    await waitFor(() => {
      expect(eventCallback).not.toBeNull();
    });

    act(() => {
      eventCallback!({ id: '1', title: 'Test 1' });
    });

    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('1');
    });

    rerender(
      <ZocketProvider<TestRouter> url="ws://localhost:3000">
        <TestComponent />
      </ZocketProvider>
    );

    act(() => {
      eventCallback!({ id: '2', title: 'Test 2' });
    });

    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('2');
    });

    expect(subscribeCount).toBe(1);
  });
});

describe('Integration Tests', () => {
  beforeEach(() => {
    mockCreateZocketClient.mockClear();
    mockClient.close.mockClear();
    mockClient.send.posts.create.mockClear();
  });

  it('should allow sending and receiving messages', async () => {
    let eventCallback: ((data: any) => void) | null = null;

    const subscribeFn = (callback: (data: any) => void) => {
      eventCallback = callback;
      return () => { };
    };

    const handler = mock((data: any) => { });

    const TestComponent = () => {
      const { client, useEvent } = useZocket<TestRouter>();
      const [messages, setMessages] = useState<any[]>([]);

      useEvent(subscribeFn, (data) => {
        setMessages((prev) => [...prev, data]);
      });

      const sendMessage = () => {
        // @ts-ignore - mock client is typed as any
        client.send.posts.create({ title: 'Hello' });
      };

      return (
        <div>
          <button onClick={sendMessage} data-testid="send-btn">
            Send
          </button>
          <div data-testid="messages">
            {messages.map((msg, i) => (
              <div key={i}>{msg.title}</div>
            ))}
          </div>
        </div>
      );
    };

    render(
      <ZocketProvider<TestRouter> url="ws://localhost:3000">
        <TestComponent />
      </ZocketProvider>
    );

    const sendBtn = screen.getByTestId('send-btn');
    sendBtn.click();

    expect(mockClient.send.posts.create).toHaveBeenCalledWith({ title: 'Hello' });

    await waitFor(() => {
      expect(eventCallback).not.toBeNull();
    });

    act(() => {
      eventCallback!({ id: '1', title: 'Response' });
    });

    await waitFor(() => {
      expect(screen.getByTestId('messages').textContent).toContain('Response');
    });
  });

  it('should handle multiple event listeners', async () => {
    let postCallback: ((data: any) => void) | null = null;
    let userCallback: ((data: any) => void) | null = null;

    const postSubscribeFn = (callback: (data: any) => void) => {
      postCallback = callback;
      return () => { };
    };

    const userSubscribeFn = (callback: (data: any) => void) => {
      userCallback = callback;
      return () => { };
    };

    const TestComponent = () => {
      const { useEvent } = useZocket<TestRouter>();
      const [posts, setPosts] = useState<any[]>([]);
      const [users, setUsers] = useState<any[]>([]);

      useEvent(postSubscribeFn, (data) => {
        setPosts((prev) => [...prev, data]);
      });

      useEvent(userSubscribeFn, (data) => {
        setUsers((prev) => [...prev, data]);
      });

      return (
        <div>
          <div data-testid="posts">{posts.length}</div>
          <div data-testid="users">{users.length}</div>
        </div>
      );
    };

    render(
      <ZocketProvider<TestRouter> url="ws://localhost:3000">
        <TestComponent />
      </ZocketProvider>
    );

    await waitFor(() => {
      expect(postCallback).not.toBeNull();
      expect(userCallback).not.toBeNull();
    });

    act(() => {
      postCallback!({ id: '1', title: 'Post 1' });
      userCallback!({ name: 'User 1' });
    });

    await waitFor(() => {
      expect(screen.getByTestId('posts').textContent).toBe('1');
      expect(screen.getByTestId('users').textContent).toBe('1');
    });
  });
});


