import { useEffect, useMemo, useRef, useState } from "react";
import {
  Eraser,
  Palette,
  Play,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";

import { createClient } from "../../client/src/index";
import type {
  ExampleApp,
  ExampleGameState,
  ExampleStroke,
} from "../server";
import { zocket } from "@/lib/zocket";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const WS_URL =
  import.meta.env.VITE_ZOCKET_URL ??
  `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:3000`;
const GAME_ID = "lobby";
const BRUSH_PRESETS = [3, 6, 10] as const;
const COLOR_PRESETS = [
  "#0F172A",
  "#F97316",
  "#DC2626",
  "#2563EB",
  "#16A34A",
  "#7C3AED",
] as const;

type GameState = ExampleGameState;
type Stroke = ExampleStroke;
type Player = GameState["players"][number];
type Guess = GameState["guesses"][number];
type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  tone: "default" | "success" | "warning";
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeTime(timestamp: number) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export default function App() {
  const client = useMemo(
    () =>
      createClient<ExampleApp>({
        url: WS_URL,
        reconnect: true,
      }),
    [],
  );

  useEffect(() => () => client.$close(), [client]);

  return (
    <zocket.ZocketProvider client={client}>
      <DrawingGuessGame />
    </zocket.ZocketProvider>
  );
}

function DrawingGuessGame() {
  const status = zocket.useConnectionStatus();
  const game = zocket.useActor("game", GAME_ID);
  const state = zocket.useActorState(game);

  const [name, setName] = useState("Nova");
  const [color, setColor] = useState("#F97316");
  const [guessDraft, setGuessDraft] = useState("");
  const [localConnectionId, setLocalConnectionId] = useState<string | null>(null);
  const [secretWord, setSecretWord] = useState<string | null>(null);
  const [brushColor, setBrushColor] = useState("#0F172A");
  const [brushWidth, setBrushWidth] = useState<(typeof BRUSH_PRESETS)[number]>(6);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [lastCall, setLastCall] = useState("Waiting for the first connection.");

  function pushActivity(item: Omit<ActivityItem, "id">) {
    setActivity((prev) => [{ ...item, id: createId() }, ...prev].slice(0, 10));
  }

  useEffect(() => {
    if (status !== "connected") return;

    void game
      .identify({ name, color })
      .then((result) => {
        setLocalConnectionId(result.player.connectionId);
        setLastCall(`identify → ${result.player.name}, ${result.onlineCount} online`);
      })
      .catch((error) => {
        setLastCall(
          `identify failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
  }, [game, status]);

  zocket.useEvent(game, "presenceChanged", (payload) => {
    pushActivity({
      title: payload.online ? `${payload.name} joined` : `${payload.name} left`,
      detail: payload.online ? "Presence synced to all subscribers." : "Connection closed.",
      tone: payload.online ? "success" : "warning",
    });
  });

  zocket.useEvent(game, "roundStarted", (payload) => {
    pushActivity({
      title: `Round ${payload.round} started`,
      detail: `${payload.drawerName} is drawing a ${payload.wordLength}-letter word.`,
      tone: "default",
    });
  });

  zocket.useEvent(game, "roundEnded", (payload) => {
    const detail =
      payload.reason === "guessed"
        ? `${payload.winnerName ?? "Someone"} guessed "${payload.word}".`
        : payload.reason === "drawer-left"
          ? `The drawer left. The word was "${payload.word}".`
          : `Round replaced. The old word was "${payload.word}".`;

    pushActivity({
      title: "Round revealed",
      detail,
      tone: payload.reason === "guessed" ? "success" : "warning",
    });
  });

  zocket.useEvent(game, "guessSubmitted", (payload) => {
    pushActivity({
      title: `${payload.by} guessed`,
      detail: payload.correct ? `"${payload.text}" was correct.` : `"${payload.text}" missed.`,
      tone: payload.correct ? "success" : "default",
    });
  });

  zocket.useEvent(game, "strokeCommitted", (payload) => {
    pushActivity({
      title: `${payload.by} drew a stroke`,
      detail: `${payload.count} strokes currently on the board.`,
      tone: "default",
    });
  });

  const players = state?.players ?? [];
  const onlinePlayers = players.filter((player) => player.online);
  const me = players.find((player) => player.connectionId === localConnectionId) ?? null;
  const isDrawer =
    Boolean(localConnectionId) &&
    state?.phase === "drawing" &&
    state.drawerConnectionId === localConnectionId;
  const canGuess =
    Boolean(localConnectionId) &&
    state?.phase === "drawing" &&
    state.drawerConnectionId !== localConnectionId;
  const currentPrompt = !state
    ? "Waiting for state snapshot..."
    : state.phase === "lobby"
      ? "Need at least two connected players to start."
      : state.phase === "drawing"
        ? isDrawer
          ? `Draw this word: ${secretWord ?? "Loading your prompt..."}`
          : `Guess the word: ${state.maskedWord}`
        : `Round over: ${state.revealedWord ?? "word unavailable"}`;

  useEffect(() => {
    if (!isDrawer || status !== "connected" || state?.phase !== "drawing") {
      setSecretWord(null);
      return;
    }

    void game.peekWord().then((result) => {
      setSecretWord(result.ok ? result.word : null);
    });
  }, [game, isDrawer, state?.phase, state?.round, status]);

  async function syncProfile() {
    const result = await game.identify({ name, color });
    setLocalConnectionId(result.player.connectionId);
    setLastCall(`identify → ${result.player.name}, ${result.onlineCount} online`);
  }

  async function startRound() {
    const result = await game.startRound();
    if (!result.ok) {
      setLastCall("startRound → need at least two online players");
      return;
    }
    setLastCall(`startRound → ${result.drawerName} is drawing`);
    if (!result.isDrawer) {
      setSecretWord(null);
    }
  }

  async function clearBoard() {
    const result = await game.clearBoard();
    setLastCall(result.ok ? "clearBoard → success" : "clearBoard → ignored");
  }

  async function submitGuess() {
    const text = guessDraft.trim();
    if (!text) return;
    const result = await game.submitGuess({ text });
    setLastCall(
      !result.ok
        ? "submitGuess → ignored"
        : result.correct
          ? "submitGuess → correct"
          : "submitGuess → incorrect",
    );
    setGuessDraft("");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-grid">
      <div className="pointer-events-none absolute -left-20 top-24 h-72 w-72 animate-float rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.28),transparent_62%)]" />
      <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 animate-float rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.22),transparent_60%)]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 animate-float rounded-full bg-[radial-gradient(circle,rgba(234,179,8,0.18),transparent_62%)]" />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10">
        <header className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <Card className="border-white/70 bg-white/85">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="accent">Drawing Guess Demo</Badge>
                <Badge
                  variant={
                    status === "connected"
                      ? "success"
                      : status === "reconnecting"
                        ? "warning"
                        : "danger"
                  }
                >
                  {status}
                </Badge>
                <Badge variant="muted">{WS_URL.replace(/^wss?:\/\//, "")}</Badge>
              </div>
              <div className="space-y-3">
                <CardTitle className="text-4xl sm:text-5xl">
                  Patches, guesses, and one shared canvas.
                </CardTitle>
                <CardDescription className="max-w-2xl text-base text-muted-foreground">
                  This example uses one actor instance for the whole game. The board state is synced by
                  snapshot plus patches, while events drive the activity feed. Open a second tab to play
                  against yourself and watch the strokes propagate.
                </CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card className="border-white/70 bg-white/85">
            <CardHeader>
              <CardTitle className="text-lg">Player Setup</CardTitle>
              <CardDescription>Your connection becomes a player entry on the actor.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Player name" />
              <div className="flex flex-wrap items-center gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setColor(preset)}
                    className={cn(
                      "h-9 w-9 rounded-full border-2 transition",
                      color === preset ? "border-slate-900 scale-110" : "border-white/70",
                    )}
                    style={{ backgroundColor: preset }}
                  />
                ))}
              </div>
              <Button className="w-full" onClick={() => void syncProfile()}>
                Sync profile
              </Button>
              <p className="text-xs text-muted-foreground">{lastCall}</p>
            </CardContent>
          </Card>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Users}
            label="Players Online"
            value={String(onlinePlayers.length)}
            detail={`${players.length} known connections`}
          />
          <MetricCard
            icon={Trophy}
            label="Round"
            value={state ? String(state.round) : "0"}
            detail={state ? state.phase : "waiting"}
          />
          <MetricCard
            icon={Palette}
            label="Strokes"
            value={String(state?.strokes.length ?? 0)}
            detail={
              state?.updatedAt
                ? `Updated ${relativeTime(state.updatedAt)}`
                : "No drawing yet"
            }
          />
          <MetricCard
            icon={Sparkles}
            label="Latest Winner"
            value={
              state?.winnerConnectionId
                ? players.find((player) => player.connectionId === state.winnerConnectionId)?.name ??
                  "winner"
                : "None"
            }
            detail={state?.revealedWord ? `Word: ${state.revealedWord}` : "Round still open"}
          />
        </section>

        <Tabs defaultValue="game">
          <TabsList>
            <TabsTrigger value="game">Game</TabsTrigger>
            <TabsTrigger value="snapshot">Snapshot</TabsTrigger>
          </TabsList>

          <TabsContent value="game">
            <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
              <div className="space-y-6">
                <Card className="border-white/70 bg-white/85">
                  <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-2">
                      <CardTitle>Round Prompt</CardTitle>
                      <CardDescription>
                        The word itself is only returned to the drawer when the round starts. Everyone else sees the masked hint in shared state.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="default">{state?.phase ?? "loading"}</Badge>
                      <Button
                        variant="secondary"
                        onClick={() => void startRound()}
                        disabled={onlinePlayers.length < 2}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Start round
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-3xl border border-dashed border-border bg-gradient-to-r from-orange-100/70 via-amber-50 to-sky-100/70 p-6">
                      <p className="heading text-3xl font-semibold tracking-wide">{currentPrompt}</p>
                      <p className="mt-3 text-sm text-slate-600">
                        {isDrawer
                          ? "You can draw on the canvas below."
                          : canGuess
                            ? "Use the guess box to submit answers."
                            : "Invite another tab or another player to join."}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="muted">
                        Drawer: {state?.drawerName ?? "nobody"}
                      </Badge>
                      <Badge variant="muted">
                        You: {me?.name ?? "anonymous"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-white/70 bg-white/85">
                  <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-2">
                      <CardTitle>Canvas</CardTitle>
                      <CardDescription>
                        Each completed stroke is a method call that appends to shared actor state.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {BRUSH_PRESETS.map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setBrushWidth(size)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-semibold",
                            brushWidth === size
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-border bg-white/70 text-slate-700",
                          )}
                        >
                          {size}px
                        </button>
                      ))}
                      {COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setBrushColor(preset)}
                          className={cn(
                            "h-8 w-8 rounded-full border-2 transition",
                            brushColor === preset ? "border-slate-900 scale-110" : "border-white/70",
                          )}
                          style={{ backgroundColor: preset }}
                        />
                      ))}
                      <Button variant="outline" onClick={() => void clearBoard()} disabled={!isDrawer}>
                        <Eraser className="mr-2 h-4 w-4" />
                        Clear
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <DrawingSurface
                      strokes={state?.strokes ?? []}
                      canDraw={Boolean(isDrawer)}
                      brushColor={brushColor}
                      brushWidth={brushWidth}
                      onCommit={async (points) => {
                        const result = await game.addStroke({
                          color: brushColor,
                          width: brushWidth,
                          points,
                        });
                        setLastCall(result.ok ? "addStroke → committed" : "addStroke → ignored");
                      }}
                    />
                  </CardContent>
                </Card>

                <Card className="border-white/70 bg-white/85">
                  <CardHeader>
                    <CardTitle>Guesses</CardTitle>
                    <CardDescription>
                      Wrong guesses stay in shared state. A correct guess ends the round and reveals the word.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-3">
                      <Input
                        value={guessDraft}
                        onChange={(event) => setGuessDraft(event.target.value)}
                        placeholder={canGuess ? "Type your guess" : "Waiting for your turn to guess"}
                        disabled={!canGuess}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void submitGuess();
                          }
                        }}
                      />
                      <Button onClick={() => void submitGuess()} disabled={!canGuess}>
                        Guess
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {(state?.guesses ?? []).map((guess) => (
                        <GuessRow key={guess.id} guess={guess} />
                      ))}
                      {(state?.guesses ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No guesses yet. Start a round and let the non-drawer players guess.
                        </p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="border-white/70 bg-white/85">
                  <CardHeader>
                    <CardTitle>Leaderboard</CardTitle>
                    <CardDescription>Player scores live in actor state too.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[...players]
                      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
                      .map((player) => (
                        <div
                          key={player.connectionId}
                          className="flex items-center justify-between rounded-2xl border border-border/70 bg-white/70 px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="h-3 w-3 rounded-full border border-white"
                              style={{ backgroundColor: player.color }}
                            />
                            <div>
                              <p className="text-sm font-semibold">{player.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {player.online ? "online" : `seen ${formatTime(player.lastSeenAt)}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="heading text-xl font-semibold">{player.score}</p>
                            {state?.drawerConnectionId === player.connectionId ? (
                              <p className="text-xs text-muted-foreground">drawing</p>
                            ) : null}
                          </div>
                        </div>
                      ))}
                  </CardContent>
                </Card>

                <Card className="border-white/70 bg-white/85">
                  <CardHeader>
                    <CardTitle>Activity Feed</CardTitle>
                    <CardDescription>
                      These are transient events alongside the synced state stream.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {activity.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No events yet. Join from another tab and start drawing.
                      </p>
                    ) : (
                      activity.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-border/70 bg-white/70 p-4"
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold">{item.title}</p>
                            <Badge variant={item.tone}>{item.tone}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{item.detail}</p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="snapshot">
            <Card className="border-white/70 bg-white/85">
              <CardHeader>
                <CardTitle>Current State Snapshot</CardTitle>
                <CardDescription>
                  This is the client-side mirror after the initial snapshot and every later patch.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded-3xl border border-border/70 bg-slate-950 p-5 text-xs leading-6 text-slate-100">
                  {JSON.stringify(
                    state ?? {
                      status,
                      note: "Waiting for the first state snapshot from the server.",
                    },
                    null,
                    2,
                  )}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function DrawingSurface({
  strokes,
  canDraw,
  brushColor,
  brushWidth,
  onCommit,
}: {
  strokes: Stroke[];
  canDraw: boolean;
  brushColor: string;
  brushWidth: number;
  onCommit: (
    points: Array<{
      x: number;
      y: number;
    }>,
  ) => Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [draft, setDraft] = useState<Array<{ x: number; y: number }>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(320, Math.round(rect.width));
      const height = Math.max(280, Math.round(rect.height));
      const ratio = window.devicePixelRatio || 1;

      canvas.width = width * ratio;
      canvas.height = height * ratio;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);

      const paintStroke = (
        stroke: Pick<Stroke, "color" | "width" | "points">,
        alpha = 1,
      ) => {
        if (stroke.points.length === 0) return;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();

        stroke.points.forEach((point, index) => {
          const x = point.x * width;
          const y = point.y * height;
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });

        if (stroke.points.length === 1) {
          const only = stroke.points[0];
          ctx.arc(only.x * width, only.y * height, stroke.width / 2, 0, Math.PI * 2);
        }

        ctx.stroke();
        ctx.restore();
      };

      for (const stroke of strokes) {
        paintStroke(stroke);
      }

      if (draft.length > 0) {
        paintStroke(
          {
            color: brushColor,
            width: brushWidth,
            points: draft,
          },
          0.65,
        );
      }
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    window.addEventListener("resize", draw);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", draw);
    };
  }, [strokes, draft, brushColor, brushWidth]);

  function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        className={cn(
          "h-[28rem] w-full rounded-3xl border border-border bg-white shadow-inner",
          canDraw ? "cursor-crosshair" : "cursor-not-allowed opacity-90",
        )}
        onPointerDown={(event) => {
          if (!canDraw) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          setDraft([pointFromEvent(event)]);
        }}
        onPointerMove={(event) => {
          if (!canDraw || draft.length === 0) return;
          setDraft((current) => [...current, pointFromEvent(event)]);
        }}
        onPointerUp={(event) => {
          if (!canDraw || draft.length === 0) return;
          event.currentTarget.releasePointerCapture(event.pointerId);
          const stroke = [...draft, pointFromEvent(event)];
          setDraft([]);
          void onCommit(stroke);
        }}
        onPointerLeave={(event) => {
          if (!canDraw || draft.length === 0) return;
          if (event.buttons !== 1) {
            setDraft([]);
          }
        }}
      />
      <p className="text-xs text-muted-foreground">
        {canDraw
          ? "Click and drag to commit one stroke at a time."
          : "Only the current drawer can paint. Everyone else receives the new strokes through state patches."}
      </p>
    </div>
  );
}

function GuessRow({ guess }: { guess: Guess }) {
  return (
    <div className="flex items-start justify-between rounded-2xl border border-border/70 bg-white/70 px-4 py-3">
      <div>
        <p className="text-sm font-semibold">{guess.by}</p>
        <p className="text-sm text-slate-700">{guess.text}</p>
      </div>
      <div className="text-right">
        <Badge variant={guess.correct ? "success" : "muted"}>
          {guess.correct ? "correct" : "miss"}
        </Badge>
        <p className="mt-1 text-xs text-muted-foreground">{formatTime(guess.at)}</p>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="border-white/70 bg-white/85">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="heading text-3xl font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="rounded-2xl bg-muted/80 p-3">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
      </CardContent>
    </Card>
  );
}
