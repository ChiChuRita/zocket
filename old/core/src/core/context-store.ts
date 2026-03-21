import { AsyncLocalStorage } from "node:async_hooks";
import type { ZocketContext } from "../server/context";
import type { AnyRouter } from "./types";

export const requestContext = new AsyncLocalStorage<
  ZocketContext<any, AnyRouter>
>();

export function getContext<TUserContext = any>() {
  const ctx = requestContext.getStore();
  if (!ctx) {
    throw new Error(
      "Zocket Context Error: 'send' or 'ctx' accessed outside of a request handler. " +
        "Make sure you are using these objects inside a message handler."
    );
  }
  return ctx as ZocketContext<TUserContext, AnyRouter>;
}
