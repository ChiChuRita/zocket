import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  MiddlewareFn,
  TypedSender,
  OutgoingDefinitions,
  IncomingMessage,
  OutgoingMessage,
  HandlerDefinition,
  AnyRouter,
  BaseContext,
  ToOutgoingRouter,
  ToIncomingRouter,
  MergeRouters,
} from "./types";
import { getContext } from "./context-store";

// --- Message Builder ---

export class MessageBuilder<TCtx = BaseContext> {
  private middlewares: MiddlewareFn<any, any, any>[] = [];

  constructor(middlewares: MiddlewareFn<any, any, any>[] = []) {
    this.middlewares = middlewares;
  }

  use<TNewCtx>(
    middleware: MiddlewareFn<TCtx, any, TNewCtx>
  ): MessageBuilder<TCtx & TNewCtx> {
    return new MessageBuilder([...this.middlewares, middleware]);
  }

  input<TInput extends StandardSchemaV1>(schema: TInput) {
    return new MessageWithInput<TCtx, TInput>(this.middlewares, schema);
  }
}

class MessageWithInput<TCtx, TInput extends StandardSchemaV1> {
  constructor(private middlewares: any[], private schema: TInput) {}

  handle<TOutput>(
    fn: (args: {
      ctx: TCtx;
      input: StandardSchemaV1.InferOutput<TInput>;
      send: any;
    }) => TOutput | Promise<TOutput>
  ): HandlerDefinition<TCtx, TInput, TOutput> {
    return {
      _type: "handler",
      input: this.schema,
      middlewares: this.middlewares,
      handler: fn,
    };
  }
}

// --- Send Proxy for Definition Time ---

function createDefinitionSendProxy(path: string[] = []): any {
  // This proxy mimics the structure of TypedSender but delegates to getContext().send at runtime
  const sender = (payload: unknown) => {
    const ctx = getContext();
    const route = path.join(".");
    // We need to find the actual sender function in ctx.send
    // But ctx.send is already a proxy or nested object.

    // We can just re-traverse ctx.send based on path
    let current: any = ctx.send;
    for (const segment of path) {
      current = current[segment];
    }

    return current(payload);
  };

  return new Proxy(sender, {
    get: (_target, prop: string) => createDefinitionSendProxy([...path, prop]),
  });
}

// --- Router Builder ---

export class RouterBuilder<TOutgoing extends OutgoingDefinitions = {}> {
  private _outgoing: TOutgoing;

  constructor(outgoing?: TOutgoing) {
    this._outgoing = outgoing || ({} as TOutgoing);
  }

  outgoing<TNewOutgoing extends OutgoingDefinitions>(
    definitions: TNewOutgoing
  ): RouterBuilder<TNewOutgoing> {
    return new RouterBuilder(definitions);
  }

  incoming<
    TProcedures extends Record<
      string,
      HandlerDefinition<any, any> | Record<string, any>
    >
  >(
    builder: (utils: { send: TypedSender<TOutgoing> }) => TProcedures
  ): MergeRouters<ToOutgoingRouter<TOutgoing>, ToIncomingRouter<TProcedures>> {
    // 1. Execute builder to get the procedure definitions
    // We pass a special Proxy that works at runtime via AsyncLocalStorage
    const procedures = builder({ send: createDefinitionSendProxy() });

    const router: AnyRouter = {};

    // 2. Helper to process Outgoing Definitions recursively
    const processOutgoing = (defs: OutgoingDefinitions, target: AnyRouter) => {
      for (const [key, val] of Object.entries(defs)) {
        if (isSchema(val)) {
          target[key] = {
            _direction: "out",
            payload: val,
          } as OutgoingMessage<any>;
        } else {
          target[key] = target[key] || {};
          processOutgoing(val as OutgoingDefinitions, target[key] as AnyRouter);
        }
      }
    };
    processOutgoing(this._outgoing, router);

    // 3. Helper to process Incoming Procedures recursively
    const processIncoming = (procs: Record<string, any>, target: AnyRouter) => {
      for (const [key, val] of Object.entries(procs)) {
        if (
          val &&
          typeof val === "object" &&
          "_type" in val &&
          val._type === "handler"
        ) {
          // It's a handler definition
          const def = val as HandlerDefinition<any, any>;
          target[key] = {
            _direction: "in",
            payload: def.input,
            _middlewares: def.middlewares,
            handler: async ({ ctx, payload }: any) => {
              // Inject the properly scoped 'send' object
              // Also ctx.send is available if they destructure 'send' from handle args
              return def.handler({ ctx, input: payload, send: ctx.send });
            },
          } as IncomingMessage<any>;
        } else if (val && typeof val === "object") {
          // Nested object
          target[key] = target[key] || {};
          processIncoming(val, target[key] as AnyRouter);
        }
      }
    };
    processIncoming(procedures, router);

    return router as any;
  }
}

// Simple check for StandardSchema (duck typing)
function isSchema(v: any): v is StandardSchemaV1 {
  return (
    v && (typeof v["~standard"] === "object" || typeof v.parse === "function")
  );
}

// --- Merge Helper ---
export function mergeRouters<TRouters extends Record<string, AnyRouter>>(
  routers: TRouters
): AnyRouter {
  const merged: AnyRouter = {};
  for (const [key, router] of Object.entries(routers)) {
    merged[key] = router;
  }
  return merged;
}
