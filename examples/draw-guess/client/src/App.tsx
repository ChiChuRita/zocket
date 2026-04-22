import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EventPayload } from "@zocket/core";
import type { app } from "../../actors";
import { client, wsUrl, zocket } from "./zocket";

type RoomActor = (typeof app)["actors"]["room"];
type StrokeEvent = EventPayload<RoomActor, "stroke">;
type ChatEvent = EventPayload<RoomActor, "chat">;
type CorrectEvent = EventPayload<RoomActor, "correct">;

type FeedItem = { id: string; tone: "chat" | "correct" | "system"; text: string };

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function resolveRoomId() {
  return window.location.pathname.replace(/^\/+|\/+$/g, "") || "main";
}

export default function App() {
  return (
    <zocket.ZocketProvider client={client}>
      <Game />
    </zocket.ZocketProvider>
  );
}

function Game() {
  const roomId = useMemo(resolveRoomId, []);
  const room = zocket.useActor("room", roomId);
  const status = zocket.useConnectionStatus();

  const players = zocket.useActorState(room, (s) => s.players) ?? [];
  const phase = zocket.useActorState(room, (s) => s.phase) ?? "lobby";
  const drawerId = zocket.useActorState(room, (s) => s.drawerId) ?? null;
  const hint = zocket.useActorState(room, (s) => s.hint) ?? null;
  const lastWord = zocket.useActorState(room, (s) => s.lastWord) ?? null;
  const winnerId = zocket.useActorState(room, (s) => s.winnerId) ?? null;

  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [myWord, setMyWord] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [guess, setGuess] = useState("");

  const isDrawer = joined && myId !== null && drawerId === myId;
  const canStart = phase !== "drawing" && joined && players.length >= 2;

  function pushFeed(item: FeedItem) {
    setFeed((items) => [item, ...items].slice(0, 12));
  }

  useEffect(() => {
    if (phase !== "drawing") setMyWord(null);
  }, [phase]);

  zocket.useEvent(room, "chat", (e: ChatEvent) => {
    pushFeed({ id: createId(), tone: "chat", text: `${e.from}: ${e.text}` });
  });

  zocket.useEvent(room, "correct", (e: CorrectEvent) => {
    pushFeed({
      id: createId(),
      tone: "correct",
      text: `${e.guesser} guessed "${e.word}"!`,
    });
  });

  async function join() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await room.join({ name: trimmed });
    // Find our own connectionId by diffing: we are the player that wasn't there before.
    // Easier: pick the last player with our name.
    setJoined(true);
    // We discover our id reactively below.
  }

  // Discover our own connection id: we are the player whose name matches ours
  // and who appears after we clicked join. A simple heuristic for the demo.
  useEffect(() => {
    if (!joined || myId) return;
    const mine = [...players].reverse().find((p) => p.name === name.trim());
    if (mine) setMyId(mine.id);
  }, [joined, players, name, myId]);

  async function startRound() {
    try {
      const result = await room.startRound();
      setMyWord(result.word);
      pushFeed({ id: createId(), tone: "system", text: `You are drawing: ${result.word}` });
    } catch (err) {
      pushFeed({
        id: createId(),
        tone: "system",
        text: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function submitGuess() {
    const text = guess.trim();
    if (!text) return;
    setGuess("");
    await room.guess({ text });
  }

  return (
    <div className="page-shell">
      <header className="panel hero">
        <div className="hero-row">
          <span className={`status-pill ${status}`}>{status}</span>
          <span className="mono-label">room /{roomId}</span>
        </div>
        <h1>Draw &amp; Guess, powered by Zocket.</h1>
        <p className="hero-copy">
          One shared <code>room(id)</code> actor. The drawer&apos;s strokes are broadcast as events; everyone
          else types guesses that the server validates against a private word. Open this page in two tabs
          to play.
        </p>
        <p className="mono-label">{wsUrl}</p>
      </header>

      <main className="dashboard">
        <section className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Phase · {phase}</p>
              <h2>
                {phase === "drawing"
                  ? isDrawer
                    ? `You are drawing: ${myWord ?? "…"}`
                    : `Guess the word: ${hint ?? ""}`
                  : phase === "roundOver"
                    ? `Round over — the word was "${lastWord}"`
                    : "Waiting for a drawer"}
              </h2>
            </div>
            {canStart && !isDrawer && (
              <button onClick={() => void startRound()}>I&apos;ll draw next</button>
            )}
            {isDrawer && (
              <button className="secondary" onClick={() => void room.clearCanvas()}>
                Clear canvas
              </button>
            )}
          </div>

          <DrawingCanvas
            canDraw={isDrawer}
            onStroke={(s) => void room.stroke(s)}
            room={room}
          />

          {!isDrawer && phase === "drawing" && (
            <div className="input-row">
              <div className="inline-form">
                <input
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submitGuess();
                  }}
                  placeholder="Type your guess and press Enter"
                  disabled={!joined}
                />
                <button className="secondary" onClick={() => void submitGuess()} disabled={!joined}>
                  Guess
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="panel feed-panel">
          {!joined ? (
            <div className="section-head">
              <div>
                <p className="eyebrow">Join the room</p>
                <h2>Pick a name to play.</h2>
              </div>
              <div className="inline-form">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void join();
                  }}
                  placeholder="e.g. ada"
                  maxLength={20}
                />
                <button onClick={() => void join()}>Join</button>
              </div>
            </div>
          ) : (
            <>
              <div className="section-head">
                <div>
                  <p className="eyebrow">Players</p>
                  <h2>Scoreboard</h2>
                </div>
              </div>
              <ul className="feed-list">
                {players
                  .slice()
                  .sort((a, b) => b.score - a.score)
                  .map((p) => (
                    <li key={p.id} className="feed-item">
                      {p.id === drawerId ? "✏️ " : p.id === winnerId ? "🎯 " : "• "}
                      {p.name}
                      {p.id === myId ? " (you)" : ""} — {p.score}
                    </li>
                  ))}
              </ul>

              <div className="section-head" style={{ marginTop: 16 }}>
                <div>
                  <p className="eyebrow">Guesses &amp; events</p>
                </div>
              </div>
              <ul className="feed-list">
                {feed.length === 0 ? (
                  <li className="feed-empty">No guesses yet.</li>
                ) : (
                  feed.map((item) => (
                    <li key={item.id} className={`feed-item ${item.tone}`}>
                      {item.text}
                    </li>
                  ))
                )}
              </ul>
            </>
          )}
        </aside>
      </main>
    </div>
  );
}

function DrawingCanvas({
  canDraw,
  onStroke,
  room,
}: {
  canDraw: boolean;
  onStroke: (s: StrokeEvent) => void;
  room: ReturnType<typeof zocket.useActor<"room">>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);

  const drawSegment = useCallback((s: StrokeEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#e0f2fe";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(s.x0 * canvas.width, s.y0 * canvas.height);
    ctx.lineTo(s.x1 * canvas.width, s.y1 * canvas.height);
    ctx.stroke();
  }, []);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  zocket.useEvent(room, "stroke", drawSegment);
  zocket.useEvent(room, "clear", clear);

  function toLocal(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canDraw) return;
    drawingRef.current = true;
    lastRef.current = toLocal(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canDraw || !drawingRef.current || !lastRef.current) return;
    const curr = toLocal(e);
    const seg = { x0: lastRef.current.x, y0: lastRef.current.y, x1: curr.x, y1: curr.y };
    lastRef.current = curr;
    onStroke(seg);
  }

  function onUp(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    lastRef.current = null;
    canvasRef.current?.releasePointerCapture(e.pointerId);
  }

  return (
    <canvas
      ref={canvasRef}
      className={`canvas ${canDraw ? "can-draw" : ""}`}
      width={800}
      height={500}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    />
  );
}
