import { useState, type FormEvent } from "react";
import type { ActorHandle } from "@zocket/core";
import type { DrawingRoom } from "../../game";
import { useActorState } from "../zocket";

type Room = ActorHandle<typeof DrawingRoom>;

export function Lobby({
  room,
  playerId,
  onJoin,
}: {
  room: Room;
  playerId: string | null;
  onJoin: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const players = useActorState(room, (s) => s.players) ?? [];

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || joining) return;
    setJoining(true);
    try {
      const result = await room.join({ name: name.trim() });
      onJoin(result.playerId);
    } finally {
      setJoining(false);
    }
  }

  async function handleStart() {
    await room.startRound();
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-5">
        <h2 className="text-xl font-semibold">Join Room</h2>

        {!playerId ? (
          <form onSubmit={handleJoin} className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={16}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm
                         placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!name.trim() || joining}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium
                         hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors"
            >
              Join
            </button>
          </form>
        ) : (
          <p className="text-sm text-zinc-400">
            You're in! Waiting for players...
          </p>
        )}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
          Players ({players.length})
        </h3>

        {players.length === 0 ? (
          <p className="text-sm text-zinc-600">No one here yet.</p>
        ) : (
          <ul className="space-y-2">
            {players.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <span className="text-sm font-medium">{p.name}</span>
                {p.id === playerId && (
                  <span className="text-xs text-zinc-500">(you)</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {playerId && players.length >= 2 && (
          <button
            onClick={handleStart}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium
                       hover:bg-emerald-500 transition-colors"
          >
            Start Game
          </button>
        )}

        {playerId && players.length < 2 && (
          <p className="text-xs text-zinc-500 text-center">
            Need at least 2 players to start
          </p>
        )}
      </div>
    </div>
  );
}
