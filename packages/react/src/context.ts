import { createContext } from "react";
import type { AnyRouter } from "@zocket/core";
import type { ZocketClient } from "@zocket/client";

export interface ZocketContextValue<TRouter extends AnyRouter> {
  client: ZocketClient<TRouter>;
}

export const ZocketContext = createContext<ZocketContextValue<any> | null>(
  null
);
