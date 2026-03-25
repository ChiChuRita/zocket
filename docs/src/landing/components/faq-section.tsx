import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";

const faqs = [
  {
    q: "What is Zocket?",
    a: "Zocket is a typed actor runtime for realtime apps. You model chats, agents, rooms, sessions, and other live product entities as actors with identity, methods, state, and subscriptions, then talk to them directly from clients.",
    sock: "🧦",
  },
  {
    q: "When should I use it?",
    a: "Use Zocket when the core units of your product are live, stateful things that clients interact with directly. If your app sounds like threads, agents, rooms, workflows, sessions, or collaborative objects, you are already close to Zocket's model.",
    sock: "🎯",
  },
  {
    q: "Why not just combine REST, WebSockets, and client state management?",
    a: "You can, but that stack usually turns one product concept into three systems you have to keep aligned: an API for mutations, a socket layer for updates, and a client-side state layer to stitch it back together. Zocket compresses that into one actor model with typed methods and built-in subscriptions.",
    sock: "🪢",
  },
  {
    q: "How does it compare to Socket.IO?",
    a: "Socket.IO gives you transport primitives: event names, payloads, rooms, and a lot of freedom. Zocket gives you a stronger application shape: actor methods, validated state schemas, sequential execution per actor, and a direct client-to-actor model. It is a better fit when the hard part is structuring live application state, not just moving messages.",
    sock: "🥊",
  },
  {
    q: "Is it a fit for chats, agents, rooms, and sessions?",
    a: "Yes. Those are exactly the kinds of product primitives Zocket is built for. Each one has identity, changing state, actions clients can invoke, and users who need to stay subscribed to it in realtime.",
    sock: "💬",
  },
  {
    q: "What does the actor model mean here?",
    a: "In Zocket, an actor is a live entity instantiated by ID with its own state, methods, events, and lifecycle. Instead of asking which event name just arrived, you ask which room, thread, or session this action belongs to. That keeps ownership and reasoning local.",
    sock: "🧠",
  },
  {
    q: "How does state synchronization work?",
    a: "Actor state is managed on the server and synchronized to subscribed clients automatically. When a method changes actor state, Zocket tracks the update as patches and broadcasts them to the clients watching that actor, so the product stays in sync without hand-rolled rebroadcast logic.",
    sock: "🔄",
  },
];

export function FAQ() {
  const [openItem, setOpenItem] = useState<string | undefined>(undefined);
  const [visited, setVisited] = useState<Set<number>>(new Set());

  const activeIndex = openItem ? parseInt(openItem.split("-")[1]) : null;
  const activeSock = activeIndex !== null ? faqs[activeIndex]?.sock : "🧦";
  const visitedCount = visited.size;

  const sockMessages = [
    "",
    "curious, are we?",
    "keep going...",
    "you're on a roll",
    "almost read them all!",
    "sock scholar in training",
    "one more to go!",
    "you actually read all of them. respect. 🫡",
  ];

  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:gap-12">
      <div className="flex-1">
        <Accordion
          type="single"
          collapsible
          value={openItem}
          onValueChange={(val) => {
            setOpenItem(val);
            if (val) {
              const idx = parseInt(val.split("-")[1]);
              setVisited((prev) => new Set(prev).add(idx));
            }
          }}
          className="flex w-full flex-col"
        >
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="group">
                <span className="flex items-center gap-3">
                  <span className="text-lg transition-transform duration-300 group-hover:scale-125">
                    {faq.sock}
                  </span>
                  {faq.q}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <div className="hidden xl:flex flex-col items-center justify-center gap-4 xl:w-[200px] xl:shrink-0">
        <div
          className="text-7xl transition-all duration-500 select-none"
          style={{
            transform: openItem ? "scale(1.2) rotate(5deg)" : "scale(1) rotate(0deg)",
            filter: openItem ? "drop-shadow(0 0 20px rgba(249,115,22,0.4))" : "none",
          }}
        >
          {activeSock}
        </div>
        {visitedCount > 0 && (
          <p className="text-center text-sm text-white/40 animate-fade-in">
            {sockMessages[Math.min(visitedCount, sockMessages.length - 1)]}
          </p>
        )}
        <div className="flex gap-1 mt-2">
          {faqs.map((_, i) => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-full transition-all duration-300"
              style={{
                backgroundColor: activeIndex === i
                  ? "rgb(249,115,22)"
                  : visited.has(i)
                    ? "rgba(249,115,22,0.3)"
                    : "rgba(255,255,255,0.1)",
                transform: activeIndex === i ? "scale(1.5)" : "scale(1)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
