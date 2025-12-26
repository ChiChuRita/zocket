import React, { type ReactNode } from "react";
import type { AnyRouter } from "@zocket/core";
import type { ZocketClient } from "@zocket/client";
import { ZocketContext } from "./context";

export interface ZocketProviderProps<TRouter extends AnyRouter> {
  client: ZocketClient<TRouter>;
  children: ReactNode;
}

export function ZocketProvider<TRouter extends AnyRouter>({
  client,
  children,
}: ZocketProviderProps<TRouter>) {
  return (
    <ZocketContext.Provider value={{ client }}>
      {children}
    </ZocketContext.Provider>
  );
}

