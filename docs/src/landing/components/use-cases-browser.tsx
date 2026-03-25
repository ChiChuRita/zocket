import { startTransition, useEffect, useRef, useState } from "react";
import { Highlight, themes } from "prism-react-renderer";

type UseCase = {
  tag: string;
  title: string;
  blurb: string;
  proofs: string[];
  delights: string[];
  runtimeHandles: string;
  codeTitle: string;
  code: string;
};

const useCases: UseCase[] = [
  {
    tag: "Support",
    title: "Support threads",
    blurb:
      "Treat each customer thread as a live serverless unit with methods, state, and subscriptions instead of bouncing between endpoints, socket events, and UI caches.",
    proofs: ["typed methods", "live state", "serverless fit"],
    delights: [
      "One handle per thread, not three layers of glue.",
      "Reply and subscribe from the same object.",
      "Selectors keep the UI focused on the state slice it actually needs.",
    ],
    runtimeHandles: "status, message history, thread actions, and subscriber updates",
    codeTitle: "support-thread.ts",
    code: `const thread = client.support("acme-42");

await thread.reply({ text: "Where is my refund?" });

const messages = useActorState(thread, (s) => s.messages);
const status = useActorState(thread, (s) => s.status);`,
  },
  {
    tag: "Agents",
    title: "Agent sessions",
    blurb:
      "Agent runs fit when each session has identity, evolving state, and clients that need to watch progress as the run unfolds on a live backend.",
    proofs: ["session identity", "status updates", "direct invocation"],
    delights: [
      "The session becomes the API surface, not a loose stream of events.",
      "State changes read like a product object, not transport plumbing.",
      "You can watch progress without inventing a second synchronization story.",
    ],
    runtimeHandles: "steps, tool progress, session status, and live session calls",
    codeTitle: "agent-session.ts",
    code: `const session = client.agent("user-17");

await session.sendUserMessage({
  text: "Draft an onboarding email",
});

session.state.subscribe((s) => console.log(s.steps, s.status));`,
  },
  {
    tag: "Realtime Rooms",
    title: "Multiplayer rooms",
    blurb:
      "Rooms, lobbies, and matches are natural realtime serverless workloads: one live runtime unit holds the state, serializes actions, and keeps everyone synced.",
    proofs: ["sequential actions", "shared state", "one room handle"],
    delights: [
      "Method calls map cleanly to the room players are actually in.",
      "State sync stays attached to the room instead of a global event bus.",
      "The runtime shape matches how teams already reason about games and rooms.",
    ],
    runtimeHandles: "players, phase, room actions, and shared room state",
    codeTitle: "room.ts",
    code: `const room = client.game("lobby-1");

await room.join({ name: "Ava" });
await room.ready();

room.state.subscribe((s) => console.log(s.players, s.phase));`,
  },
  {
    tag: "Workflows",
    title: "Approval and workflow runs",
    blurb:
      "Long-lived flows stop feeling bolted on when each run becomes a live serverless process clients can call, observe, and reason about directly.",
    proofs: ["progress tracking", "typed transitions", "live subscribers"],
    delights: [
      "The workflow run feels like a realtime backend primitive, not a row plus a polling loop.",
      "Transitions stay typed and local to the run that owns them.",
      "Progress becomes part of the product model instead of a side channel.",
    ],
    runtimeHandles: "stage, history, approvals, and run-specific transitions",
    codeTitle: "workflow-run.ts",
    code: `const run = client.workflow("invoice-17");

await run.approve({ by: "ops" });

const stage = useActorState(run, (s) => s.stage);
const history = useActorState(run, (s) => s.history);`,
  },
];

function codeClasses(isActive: boolean) {
  return [
    "group flex min-w-[280px] max-w-[320px] shrink-0 snap-center flex-col rounded-2xl border px-4 py-4 text-left transition-all duration-300",
    isActive
      ? "border-primary/35 bg-primary/[0.08] shadow-[0_0_0_1px_rgba(249,115,22,0.12),0_18px_50px_rgba(249,115,22,0.08)]"
      : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.14] hover:bg-white/[0.045]",
  ].join(" ");
}

export function UseCasesBrowser() {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = useCases[activeIndex];

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    let frame = 0;

    const syncActiveFromScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const center = scroller.scrollLeft + scroller.clientWidth / 2;
        let nearestIndex = 0;
        let nearestDistance = Number.POSITIVE_INFINITY;

        itemRefs.current.forEach((node, index) => {
          if (!node) return;
          const nodeCenter = node.offsetLeft + node.offsetWidth / 2;
          const distance = Math.abs(nodeCenter - center);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
          }
        });

        startTransition(() => setActiveIndex(nearestIndex));
      });
    };

    syncActiveFromScroll();
    scroller.addEventListener("scroll", syncActiveFromScroll, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", syncActiveFromScroll);
    };
  }, []);

  const scrollToIndex = (index: number) => {
    const clamped = Math.max(0, Math.min(index, useCases.length - 1));
    const node = itemRefs.current[clamped];
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    startTransition(() => setActiveIndex(clamped));
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Scroll through realtime serverless patterns</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
            Swipe or scroll the cases below. The detail view follows the example
            you are centered on, so you can browse the kinds of live backend
            workflows Zocket is good at without leaving the page.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start xl:self-auto">
          <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/30 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/35">
            <span>{String(activeIndex + 1).padStart(2, "0")}</span>
            <span className="text-white/15">/</span>
            <span>{String(useCases.length).padStart(2, "0")}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollToIndex(activeIndex - 1)}
              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/55 transition-colors hover:border-white/[0.14] hover:text-white"
              aria-label="Previous use case"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => scrollToIndex(activeIndex + 1)}
              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/55 transition-colors hover:border-white/[0.14] hover:text-white"
              aria-label="Next use case"
            >
              →
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
      >
        {useCases.map((useCase, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={useCase.title}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              onClick={() => scrollToIndex(index)}
              className={codeClasses(isActive)}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-primary/80">
                    {useCase.tag}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-white">{useCase.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">
                    {useCase.blurb}
                  </p>
                </div>
                <span className="font-mono text-sm text-white/20">
                  0{index + 1}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-md xl:p-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex rounded-full border border-primary/20 bg-primary/[0.08] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-primary/80">
                {active.tag}
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">
                {active.title}
              </h2>
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/58">
                {active.blurb}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {active.proofs.map((proof) => (
              <span
                key={proof}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-white/55"
              >
                {proof}
              </span>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d0d]/92 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <div className="flex items-center border-b border-white/[0.06] px-5 py-3">
                <div className="flex gap-2">
                  <div className="h-3 w-3 rounded-full bg-white/[0.08]"></div>
                  <div className="h-3 w-3 rounded-full bg-white/[0.08]"></div>
                  <div className="h-3 w-3 rounded-full bg-white/[0.08]"></div>
                </div>
                <span className="mx-auto font-mono text-[11px] uppercase tracking-wide text-white/25">
                  {active.codeTitle}
                </span>
                <div className="w-[48px]"></div>
              </div>

              <Highlight code={active.code} language="typescript" theme={themes.githubDark}>
                {({ style, tokens, getLineProps, getTokenProps }) => (
                  <pre
                    style={{ ...style, backgroundColor: "transparent" }}
                    className="overflow-auto px-5 py-4 text-[13px] leading-relaxed"
                  >
                    {tokens.map((line, index) => (
                      <div key={index} {...getLineProps({ line })}>
                        {line.map((token, tokenIndex) => (
                          <span key={tokenIndex} {...getTokenProps({ token })} />
                        ))}
                      </div>
                    ))}
                  </pre>
                )}
              </Highlight>
            </div>

            <div className="grid gap-4">
              <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/38">
                  why it feels good
                </h3>
                <ul className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-white/55">
                  {active.delights.map((delight) => (
                    <li key={delight} className="flex gap-3">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80"></span>
                      <span>{delight}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/38">
                  runtime handles
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-white/55">
                  {active.runtimeHandles}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
