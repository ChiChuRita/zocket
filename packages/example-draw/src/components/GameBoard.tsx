import { useState, useRef, useEffect, type FormEvent } from "react";
import type { ActorHandle } from "@zocket/core";
import type { DrawingRoom } from "../../game";
import { useActorState, useEvent } from "../zocket";
import { Canvas } from "./Canvas";

type Room = ActorHandle<typeof DrawingRoom>;

export function GameBoard({
  room,
  playerId,
}: {
  room: Room;
  playerId: string;
}) {
  const state = useActorState(room);
  const [guessText, setGuessText] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEvent(room, "correctGuess", (payload) => {
    setToast(`${payload.name} guessed "${payload.word}"!`);
    setTimeout(() => setToast(null), 3000);
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.guesses.length]);

  if (!state) {
    return <p className="text-zinc-500">Loading...</p>;
  }

  const isDrawer = playerId === state.drawerId;
  const drawer = state.players.find((p) => p.id === state.drawerId);
  const isRoundEnd = state.phase === "roundEnd";

  async function handleGuess(e: FormEvent) {
    e.preventDefault();
    if (!guessText.trim() || isDrawer) return;
    await room.guess({ playerId, text: guessText.trim() });
    setGuessText("");
  }

  async function handleNextRound() {
    const { done } = await room.nextRound();
    if (!done) {
      await room.startRound();
    }
  }

  return (
    <div className="w-full max-w-5xl space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3">
        <div className="flex items-center gap-4">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Round {state.round}/{state.maxRounds}
          </span>
          {drawer && (
            <span className="text-sm text-zinc-400">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full mr-1.5 align-middle"
                style={{ backgroundColor: drawer.color }}
              />
              {isDrawer ? "You are drawing!" : `${drawer.name} is drawing`}
            </span>
          )}
        </div>
        <span className="text-lg font-mono tracking-[0.25em] text-zinc-200">
          {isDrawer ? state.word : state.hint}
        </span>
      </div>

      {/* Toast */}
      {toast && (
        <div className="rounded-lg bg-emerald-600/20 border border-emerald-500/30 px-4 py-2 text-sm text-emerald-300 text-center">
          {toast}
        </div>
      )}

      {/* Main layout */}
      <div className="grid grid-cols-[1fr_320px] gap-4">
        {/* Canvas */}
        <Canvas room={room} isDrawer={isDrawer && !isRoundEnd} />

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Guesses chat */}
          <div className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 flex flex-col min-h-0">
            <div className="px-4 py-2.5 border-b border-zinc-800">
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Guesses
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 max-h-64">
              {state.guesses.length === 0 && (
                <p className="text-xs text-zinc-600 py-2 text-center">
                  No guesses yet
                </p>
              )}
              {state.guesses.map((g, i) => (
                <div
                  key={i}
                  className={`text-sm px-2.5 py-1.5 rounded-lg ${
                    g.correct
                      ? "bg-emerald-600/20 text-emerald-300"
                      : "text-zinc-400"
                  }`}
                >
                  <span className="font-medium text-zinc-200">{g.name}</span>{" "}
                  {g.text}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {!isDrawer && !isRoundEnd && (
              <form onSubmit={handleGuess} className="p-3 pt-0">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={guessText}
                    onChange={(e) => setGuessText(e.target.value)}
                    placeholder="Type your guess..."
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm
                               placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={!guessText.trim()}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium
                               hover:bg-blue-500 disabled:opacity-40 transition-colors"
                  >
                    Guess
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Scoreboard */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-2">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Scoreboard
            </h3>
            <ul className="space-y-1.5">
              {[...state.players]
                .sort((a, b) => b.score - a.score)
                .map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className={p.id === playerId ? "font-medium" : "text-zinc-400"}>
                        {p.name}
                      </span>
                      {p.id === state.drawerId && (
                        <span className="text-[10px] text-amber-400 font-medium">✏️</span>
                      )}
                    </div>
                    <span className="font-mono text-zinc-300">{p.score}</span>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Round end overlay */}
      {isRoundEnd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-8 text-center space-y-4 max-w-sm w-full mx-4">
            <h2 className="text-xl font-semibold">Round Over!</h2>
            <p className="text-zinc-400">
              The word was{" "}
              <span className="text-white font-medium">"{state.word}"</span>
            </p>
            <div className="space-y-1 pt-2">
              {[...state.players]
                .sort((a, b) => b.score - a.score)
                .map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm px-2">
                    <span
                      className="flex items-center gap-2"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      {p.name}
                    </span>
                    <span className="font-mono">{p.score} pts</span>
                  </div>
                ))}
            </div>
            <button
              onClick={handleNextRound}
              className="mt-2 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium
                         hover:bg-blue-500 transition-colors"
            >
              {state.round >= state.maxRounds ? "Back to Lobby" : "Next Round"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
