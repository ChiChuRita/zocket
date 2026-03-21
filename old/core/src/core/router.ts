import type { IncomingMessage, OutgoingMessage, MessageDef } from "./types";

export function isMessageDef(
  v: unknown
): v is IncomingMessage<MessageDef, any> | OutgoingMessage<MessageDef> {
  return (
    !!v &&
    typeof v === "object" &&
    (v as any)._direction !== undefined &&
    ((v as any)._direction === "in" || (v as any)._direction === "out")
  );
}

export function getNested(obj: any, path: string[]) {
  return path.reduce(
    (acc, key) => (acc && typeof acc === "object" ? acc[key] : undefined),
    obj
  );
}

export function flattenRouter(
  base: Record<string, any>,
  handlers: Record<string, any> | undefined,
  path: string[],
  out: Record<string, any>
): void {
  for (const key of Object.keys(base)) {
    const value = base[key];
    const nextPath = [...path, key];

    if (isMessageDef(value)) {
      const flatKey = nextPath.join(".");

      // Check external handler (old API)
      let handler =
        handlers && typeof handlers === "object"
          ? (handlers as any)[key]
          : undefined;

      // Check inline handler (new API)
      if (!handler && typeof (value as any).handler === "function") {
        handler = (value as any).handler;
      }

      const entry: Record<string, any> = { payload: (value as any).payload };

      if ((value as any)._middlewares)
        entry._middlewares = (value as any)._middlewares;

      if ((value as any)._direction === "in" && typeof handler === "function") {
        entry.handler = handler;
      }
      out[flatKey] = entry;
      continue;
    }

    if (value && typeof value === "object") {
      flattenRouter(value, handlers ? handlers[key] : undefined, nextPath, out);
    }
  }
}
