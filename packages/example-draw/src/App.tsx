import { useState } from "react";
import { ZocketProvider, useActor, useActorState, client } from "./zocket";
import { Lobby } from "./components/Lobby";
import { GameBoard } from "./components/GameBoard";

function getRoomId(): string {
  return window.location.hash.slice(1) || "room-1";
}

function RoomView() {
  const roomId = getRoomId();
  const room = useActor("draw", roomId);
  const phase = useActorState(room, (s) => s.phase);
  const [playerId, setPlayerId] = useState<string | null>(null);

  if (!phase || phase === "lobby") {
    return (
      <Lobby
        room={room}
        playerId={playerId}
        onJoin={setPlayerId}
      />
    );
  }

  return (
    <GameBoard
      room={room}
      playerId={playerId ?? ""}
    />
  );
}

export function App() {
  return (
    <ZocketProvider client={client}>
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-zinc-800 px-6 py-3 flex items-center gap-3">
          <span className="text-lg font-semibold tracking-tight">Zocket Draw</span>
          <span className="text-xs text-zinc-500 font-mono">#{getRoomId()}</span>
        </header>
        <main className="flex-1 flex items-center justify-center p-6">
          <RoomView />
        </main>
      </div>
    </ZocketProvider>
  );
}
