import { useState } from "react";

interface Comparison {
  id: string;
  competitor: string;
  useCase: string;
  description: string;
  competitorCode: string;
  competitorFile: string;
  zocketCode: string;
  zocketFile: string;
  takeaway: string;
}

const comparisons: Comparison[] = [
  {
    id: "socketio",
    competitor: "Socket.io",
    useCase: "Chat Room",
    description: "A chat room with message history and online presence.",
    competitorFile: "server.ts",
    competitorCode: `const io = new Server(3000);
const rooms = new Map();

io.on("connection", (socket) => {
  let room = null, name = null;

  socket.on("join", ({ room: r, name: n }) => {
    room = r; name = n;
    socket.join(r);
    const state = getRoom(r);
    state.online.add(n);
    socket.emit("history", state.messages);
    io.to(r).emit("presence", [...state.online]);
  });

  socket.on("sendMessage", ({ text }) => {
    if (!room || !name) return;
    const msg = { from: name, text };
    getRoom(room).messages.push(msg);
    io.to(room).emit("newMessage", msg);
  });

  socket.on("disconnect", () => {
    if (!room || !name) return;
    getRoom(room).online.delete(name);
    io.to(room).emit("presence", [...]);
  });
});`,
    zocketFile: "chat.ts",
    zocketCode: `const ChatRoom = actor({
  state: z.object({
    messages: z.array(z.object({
      from: z.string(),
      text: z.string(),
    })).default([]),
    online: z.array(z.string()).default([]),
  }),

  methods: {
    join: {
      input: z.object({ name: z.string() }),
      handler: ({ state, input }) => {
        state.online.push(input.name);
      },
    },
    sendMessage: {
      input: z.object({ from: z.string(), text: z.string() }),
      handler: ({ state, input }) => {
        state.messages.push(input);
      },
    },
  },

  onDisconnect({ state, connectionId }) {
    const i = state.online.indexOf(connectionId);
    if (i !== -1) state.online.splice(i, 1);
  },
});`,
    takeaway: "No manual broadcasting, no room management, no untyped events. State syncs automatically.",
  },
  {
    id: "liveblocks",
    competitor: "Liveblocks",
    useCase: "Live Cursors",
    description: "Users see each other's cursors in real-time on a shared canvas.",
    competitorFile: "app.tsx",
    competitorCode: `import {
  LiveblocksProvider,
  RoomProvider,
  useOthers,
  useUpdateMyPresence,
} from "@liveblocks/react";

const client = createClient({
  publicApiKey: "pk_live_xxx",
});

function Cursors() {
  const others = useOthers();
  const update = useUpdateMyPresence();

  useEffect(() => {
    const h = (e: MouseEvent) => {
      update({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  return others.map(({ connectionId, presence }) => (
    <Cursor key={connectionId} x={presence.x} y={presence.y} />
  ));
}

// Must wrap in LiveblocksProvider + RoomProvider
// Data goes through Liveblocks servers
// Pricing per monthly active user`,
    zocketFile: "cursors.ts + app.tsx",
    zocketCode: `// Server
const Workspace = actor({
  state: z.object({
    cursors: z.record(z.object({
      x: z.number(), y: z.number(), name: z.string(),
    })).default({}),
  }),
  methods: {
    updateCursor: {
      input: z.object({ x: z.number(), y: z.number(), name: z.string() }),
      handler: ({ state, input, connectionId }) => {
        state.cursors[connectionId] = input;
      },
    },
  },
  onDisconnect({ state, connectionId }) {
    delete state.cursors[connectionId];
  },
});

// Client
function Cursors() {
  const ws = useActor("workspace", "main");
  const cursors = useActorState(ws, s => s.cursors);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      ws.updateCursor({ x: e.clientX, y: e.clientY, name: "Alice" });
    };
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  return Object.entries(cursors ?? {}).map(([id, c]) => (
    <Cursor key={id} x={c.x} y={c.y} name={c.name} />
  ));
}`,
    takeaway: "Self-hosted, no vendor lock-in, no per-user pricing. Same DX, you own the data.",
  },
  {
    id: "rivet",
    competitor: "Rivet",
    useCase: "Game Match",
    description: "Players join a lobby, match starts, server tracks scores.",
    competitorFile: "match.ts",
    competitorCode: `class MatchActor extends Actor {
  override initialize() {
    return {
      players: [],
      phase: "lobby",
      round: 0,
    };
  }

  join(rpc, playerId) {
    this.state.players.push({ id: playerId, score: 0 });
    this.broadcast("playerJoined", { playerId });
  }

  startRound(rpc) {
    this.state.phase = "playing";
    this.state.round += 1;
    this.broadcast("roundStarted", { round: this.state.round });
  }

  submitAnswer(rpc, playerId, correct) {
    const p = this.state.players.find(p => p.id === playerId);
    if (p && correct) p.score += 10;
    this.broadcast("scoreUpdate", { players: this.state.players });
  }
}

// Client
const match = await client.get({ name: "match", id: "match-123" });
match.on("scoreUpdate", (data) => { /* untyped */ });
await match.submitAnswer("player-1", true);`,
    zocketFile: "match.ts",
    zocketCode: `const Match = actor({
  state: z.object({
    players: z.array(z.object({
      id: z.string(), score: z.number(),
    })).default([]),
    phase: z.enum(["lobby", "playing", "finished"]).default("lobby"),
    round: z.number().default(0),
  }),

  methods: {
    join: {
      input: z.object({ playerId: z.string() }),
      handler: ({ state, input }) => {
        state.players.push({ id: input.playerId, score: 0 });
      },
    },
    startRound: {
      handler: ({ state }) => { state.phase = "playing"; state.round++; },
    },
    submitAnswer: {
      input: z.object({ playerId: z.string(), correct: z.boolean() }),
      handler: ({ state, input }) => {
        const p = state.players.find(p => p.id === input.playerId);
        if (p && input.correct) p.score += 10;
      },
    },
  },
});

// Client — fully typed, state syncs automatically
const match = client.match("match-123");
match.state.subscribe(s => {
  console.log(s.phase);   // "lobby" | "playing" | "finished"
  console.log(s.players); // { id: string; score: number }[]
});
await match.submitAnswer({ playerId: "p1", correct: true });`,
    takeaway: "Same actor model, but typed end-to-end. State syncs automatically instead of manual broadcast calls.",
  },
  {
    id: "temporal",
    competitor: "Temporal",
    useCase: "AI Agent",
    description: "Call an LLM, execute tools, timeout if too slow.",
    competitorFile: "workflow.ts + activities.ts + worker.ts",
    competitorCode: `// workflow.ts — must be deterministic (no Date.now, no I/O)
const { callLLM, executeTool } = proxyActivities({
  startToCloseTimeout: "30s",
});

export async function agentWorkflow(prompt: string) {
  const response = await callLLM(prompt);

  for (const tool of response.toolCalls) {
    await executeTool(tool.name, tool.args);
  }

  return await Promise.race([
    saveResult(response),
    sleep("30s").then(() => "Timeout"),
  ]);
}

// activities.ts — where actual work happens
export async function callLLM(prompt: string) { /* ... */ }
export async function executeTool(name: string, args: unknown) { /* ... */ }

// worker.ts — run the engine
const worker = await Worker.create({
  workflowsPath: require.resolve("./workflows"),
  activities,
  taskQueue: "agent-tasks",
});
await worker.run();

// client.ts — start workflow, poll for result (no streaming)
const handle = await client.workflow.start("agentWorkflow", {
  args: ["Summarize this"], taskQueue: "agent-tasks",
});
const result = await handle.result(); // blocks until done`,
    zocketFile: "agent.ts",
    zocketCode: `const AgentRun = actor({
  state: z.object({
    messages: z.array(z.any()).default([]),
    status: z.enum(["idle", "running", "done", "timeout"]).default("idle"),
  }),

  methods: {
    start: {
      input: z.object({ prompt: z.string() }),
      stream: true,
      handler: async ({ state, input, timer }) => {
        state.status = "running";
        timer.after(30_000).timeout();

        const result = streamText({
          model: openai("gpt-4o"),
          messages: [{ role: "user", content: input.prompt }],
        });

        for await (const chunk of result.textStream) {
          state.messages.push({ role: "assistant", content: chunk });
        }

        state.status = "done";
      },
    },
    timeout: {
      handler: ({ state }) => {
        if (state.status === "running") state.status = "timeout";
      },
    },
  },
});

// Client — real-time streaming, no polling
const agent = client.agent("run-123");
agent.state.subscribe(s => {
  console.log(s.status);   // updates live
  console.log(s.messages); // tokens stream in real-time
});
await agent.start({ prompt: "Summarize this" });`,
    takeaway: "One file instead of four. Real-time streaming instead of polling. No replay semantics to reason about.",
  },
];

export function ComparisonShowcase() {
  const [activeId, setActiveId] = useState("socketio");
  const active = comparisons.find((c) => c.id === activeId)!;

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {comparisons.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveId(c.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
              activeId === c.id
                ? "bg-[hsl(30,100%,50%)] text-black"
                : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white/80"
            }`}
          >
            vs {c.competitor}
          </button>
        ))}
      </div>

      {/* Use case label */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-white/40">Use case:</span>
        <span className="text-sm font-semibold text-white/90">{active.useCase}</span>
        <span className="text-sm text-white/40">— {active.description}</span>
      </div>

      {/* Code comparison */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Competitor */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#0d0d0d]/90">
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-white/[0.08]"></div>
              <div className="h-2.5 w-2.5 rounded-full bg-white/[0.08]"></div>
              <div className="h-2.5 w-2.5 rounded-full bg-white/[0.08]"></div>
            </div>
            <span className="ml-2 font-mono text-[11px] text-white/30">{active.competitorFile}</span>
            <span className="ml-auto rounded bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] text-white/40">
              {active.competitor}
            </span>
          </div>
          <pre className="max-h-[400px] overflow-auto p-4 text-[12px] leading-relaxed text-white/70">
            <code>{active.competitorCode}</code>
          </pre>
        </div>

        {/* Zocket */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-[hsl(30,100%,50%)]/20 bg-[#0d0d0d]/90">
          <div className="flex items-center gap-2 border-b border-[hsl(30,100%,50%)]/10 px-4 py-2.5">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-[hsl(30,100%,50%)]/20"></div>
              <div className="h-2.5 w-2.5 rounded-full bg-[hsl(30,100%,50%)]/20"></div>
              <div className="h-2.5 w-2.5 rounded-full bg-[hsl(30,100%,50%)]/20"></div>
            </div>
            <span className="ml-2 font-mono text-[11px] text-white/30">{active.zocketFile}</span>
            <span className="ml-auto rounded bg-[hsl(30,100%,50%)]/10 px-2 py-0.5 font-mono text-[10px] text-[hsl(30,100%,50%)]">
              Zocket
            </span>
          </div>
          <pre className="max-h-[400px] overflow-auto p-4 text-[12px] leading-relaxed text-white/70">
            <code>{active.zocketCode}</code>
          </pre>
        </div>
      </div>

      {/* Takeaway */}
      <p className="text-sm leading-relaxed text-white/50">
        {active.takeaway}
      </p>
    </div>
  );
}
