import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";

export function FAQ() {
  return (
    <Accordion
      type="single"
      collapsible
      className="flex w-full flex-col justify-between xl:flex-row xl:gap-20"
    >
      <div className="flex w-full flex-col">
        <AccordionItem value="item-0">
          <AccordionTrigger>
            What is Zocket?
          </AccordionTrigger>
          <AccordionContent>
            Zocket is a typed actor runtime for realtime applications. It lets
            you define stateful actors with typed methods, events, and lifecycle
            hooks on the server, then call them from clients with full
            end-to-end type safety over WebSockets.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-1">
          <AccordionTrigger>
            How does it compare to Socket.IO?
          </AccordionTrigger>
          <AccordionContent>
            Unlike Socket.IO, Zocket provides full end-to-end type safety using
            TypeScript. Instead of string-based events, you define typed actor
            methods and state schemas. The actor model gives you sequential
            execution guarantees — no race conditions or locks needed.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>
            What is the actor model?
          </AccordionTrigger>
          <AccordionContent>
            Actors are stateful units that process messages sequentially. Each
            actor instance has its own state and a queue of method calls. This
            gives you single-writer semantics without locks — all mutations are
            serialized. Think of each actor as a tiny server with its own state
            machine.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-3">
          <AccordionTrigger>
            What are the benefits of type safety?
          </AccordionTrigger>
          <AccordionContent>
            With Zocket, your actor state, methods, events, and inputs are all
            validated by Zod schemas and inferred by TypeScript. This means you
            get autocompletion in your IDE, compile-time error checking, and
            runtime validation — catching bugs before they reach production.
          </AccordionContent>
        </AccordionItem>
      </div>
      <div className="flex w-full flex-col">
        <AccordionItem value="item-4">
          <AccordionTrigger>
            Which runtimes are supported?
          </AccordionTrigger>
          <AccordionContent>
            Zocket supports Bun, Node.js, and Deno via dedicated server
            adapters. You can also write custom handlers for any WebSocket
            server implementation.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-5">
          <AccordionTrigger>
            Does it work with React?
          </AccordionTrigger>
          <AccordionContent>
            Yes! The @zocket/react package provides hooks like useActor,
            useActorState, and useEvent. Subscriptions are selector-based so
            components only re-render when the specific state slice they depend
            on changes.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-6">
          <AccordionTrigger>
            How does state synchronization work?
          </AccordionTrigger>
          <AccordionContent>
            Actor state is managed with Immer on the server. When you mutate
            state in a method handler, Zocket tracks the changes as JSON
            patches and broadcasts them to all subscribed clients. Clients
            automatically apply patches to stay in sync with the server.
          </AccordionContent>
        </AccordionItem>
      </div>
    </Accordion>
  );
}
