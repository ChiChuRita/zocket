import { useContext, useEffect, useLayoutEffect, useRef } from "react";
import type { AnyRouter } from "@zocket/core";
import type { ZocketClient } from "@zocket/client";
import { ZocketContext } from "./context";

type UnsubscribeFn = () => void;
type SubscribeFn<T> = (callback: (data: T) => void) => UnsubscribeFn;

export function useEvent<T>(
  subscribe: SubscribeFn<T>,
  handler: (data: T) => void,
  deps: React.DependencyList = []
) {
  const handlerRef = useRef(handler);

  useLayoutEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const unsubscribe = subscribe((data) => {
      handlerRef.current(data);
    });
    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, ...deps]);
}

export function useZocket<TRouter extends AnyRouter>() {
  const context = useContext(ZocketContext);
  if (!context) {
    throw new Error("useZocket must be used within a ZocketProvider");
  }
  return {
    client: context.client as ZocketClient<TRouter>,
    useEvent,
  };
}
