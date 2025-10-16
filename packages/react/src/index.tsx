import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { createZocketClient, ZocketClient } from '@zocket/core';
import type { AnyRouter } from '@zocket/core';

export type { ZocketClient } from '@zocket/core';
export type { AnyRouter } from '@zocket/core';

export interface ZocketProviderProps<TRouter extends AnyRouter> {
  url: string;
  children: ReactNode;
  maxReconnectionDelay?: number;
  minReconnectionDelay?: number;
  reconnectionDelayGrowFactor?: number;
  maxRetries?: number;
  debug?: boolean;
  headers?: Record<string, string>;
  onOpen?: () => void;
  onClose?: () => void;
}

const ZocketContext = createContext<ZocketClient<any> | null>(null);

export function ZocketProvider<TRouter extends AnyRouter>({
  url,
  children,
  maxReconnectionDelay,
  minReconnectionDelay,
  reconnectionDelayGrowFactor,
  maxRetries,
  debug,
  headers,
  onOpen,
  onClose,
}: ZocketProviderProps<TRouter>) {
  const [client] = useState(() =>
    createZocketClient<TRouter>(url, {
      maxReconnectionDelay,
      minReconnectionDelay,
      reconnectionDelayGrowFactor,
      maxRetries,
      debug,
      headers,
      onOpen,
      onClose,
    })
  );

  useEffect(() => {
    return () => {
      client.close();
    };
  }, [client]);

  return (
    <ZocketContext.Provider value={client}>
      {children}
    </ZocketContext.Provider>
  );
}

export function useZocket<TRouter extends AnyRouter>() {
  const client = useContext(ZocketContext) as ZocketClient<TRouter> | null;

  if (!client) {
    throw new Error('useZocket must be used within a ZocketProvider');
  }

  const useEvent = <TPayload,>(
    subscribeFn: (callback: (payload: TPayload) => void) => () => void,
    handler: (payload: TPayload) => void
  ): void => {
    const handlerRef = useRef(handler);

    useEffect(() => {
      handlerRef.current = handler;
    });

    useEffect(() => {
      const unsubscribe = subscribeFn((payload: TPayload) => {
        handlerRef.current(payload);
      });

      return unsubscribe;
    }, [subscribeFn]);
  };

  return {
    client,
    useEvent,
  };
}

