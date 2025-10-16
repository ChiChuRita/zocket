import { useState, useEffect, useRef } from "react";
import { Stage, Layer, Rect, Circle, Line } from "react-konva";
import { ZocketProvider, useZocket } from "@zocket/react";
import type { GameRouter } from "../shared";
import "./App.css";

const WIDTH = 800;
const HEIGHT = 480;
const PADDLE_W = 12;
const PADDLE_H = 80;
const PADDLE_X_LEFT = 20;
const PADDLE_X_RIGHT = WIDTH - PADDLE_X_LEFT - PADDLE_W;
const BALL_R = 8;

type GameState = {
  ball: { x: number; y: number };
  paddles: { leftY: number; rightY: number };
  scores: { left: number; right: number };
  status: "waiting" | "playing" | "point";
  players: { left?: string; right?: string };
};

type Side = "left" | "right" | "spectator";

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getRoomFromURL(): string {
  const params = new URLSearchParams(window.location.search);
  const room = params.get("room");
  if (room) return room;

  const newRoom = generateRoomCode();
  const newUrl = `${window.location.pathname}?room=${newRoom}`;
  window.history.replaceState({}, "", newUrl);
  return newRoom;
}

function GameCanvas({ username, roomId }: { username: string; roomId: string }) {
  const [gameState, setGameState] = useState<GameState>({
    ball: { x: WIDTH / 2, y: HEIGHT / 2 },
    paddles: { leftY: HEIGHT / 2 - PADDLE_H / 2, rightY: HEIGHT / 2 - PADDLE_H / 2 },
    scores: { left: 0, right: 0 },
    status: "waiting",
    players: {},
  });
  const [renderedState, setRenderedState] = useState<GameState>({
    ball: { x: WIDTH / 2, y: HEIGHT / 2 },
    paddles: { leftY: HEIGHT / 2 - PADDLE_H / 2, rightY: HEIGHT / 2 - PADDLE_H / 2 },
    scores: { left: 0, right: 0 },
    status: "waiting",
    players: {},
  });
  const [side, setSide] = useState<Side>("spectator");
  const { client, useEvent } = useZocket<GameRouter>();
  const currentDirRef = useRef<"up" | "down" | "stop">("stop");
  const prevStateRef = useRef<GameState | null>(null);
  const currentStateRef = useRef<GameState | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  useEffect(() => {
    client.send.game.join({ roomId, username });
  }, [client, roomId, username]);

  useEvent(client.on.game.assign, (data) => {
    setSide(data.side);
    console.log("Assigned side:", data.side);
  });

  useEvent(client.on.game.state, (data) => {
    prevStateRef.current = currentStateRef.current || data;
    currentStateRef.current = data;
    lastUpdateTimeRef.current = performance.now();
    setGameState(data);
  });

  useEffect(() => {
    const SERVER_UPDATE_INTERVAL = 1000 / 30;
    let animationFrameId: number;

    const interpolate = () => {
      if (!prevStateRef.current || !currentStateRef.current) {
        animationFrameId = requestAnimationFrame(interpolate);
        return;
      }

      const now = performance.now();
      const timeSinceUpdate = now - lastUpdateTimeRef.current;
      const t = Math.min(timeSinceUpdate / SERVER_UPDATE_INTERVAL, 1);

      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

      const interpolated: GameState = {
        ball: {
          x: lerp(prevStateRef.current.ball.x, currentStateRef.current.ball.x, t),
          y: lerp(prevStateRef.current.ball.y, currentStateRef.current.ball.y, t),
        },
        paddles: {
          leftY: lerp(prevStateRef.current.paddles.leftY, currentStateRef.current.paddles.leftY, t),
          rightY: lerp(prevStateRef.current.paddles.rightY, currentStateRef.current.paddles.rightY, t),
        },
        scores: currentStateRef.current.scores,
        status: currentStateRef.current.status,
        players: currentStateRef.current.players,
      };

      setRenderedState(interpolated);
      animationFrameId = requestAnimationFrame(interpolate);
    };

    animationFrameId = requestAnimationFrame(interpolate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  useEffect(() => {
    if (side === "spectator") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      let newDir: "up" | "down" | "stop" = currentDirRef.current;
      if (e.key === "ArrowUp") newDir = "up";
      else if (e.key === "ArrowDown") newDir = "down";

      if (newDir !== currentDirRef.current) {
        currentDirRef.current = newDir;
        client.send.game.move({ dir: newDir });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        currentDirRef.current = "stop";
        client.send.game.move({ dir: "stop" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [side, client]);

  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;

  return (
    <div className="game-container">
      <div className="header">
        <h1>Zocket Ping Pong</h1>
        <div className="status">
          <span className="connected">● Connected</span>
        </div>
      </div>

      <div className="scoreboard">
        <div className="score-item">
          <div className="player-name">{gameState.players.left || "Waiting..."}</div>
          <div className="score">{gameState.scores.left}</div>
        </div>
        <div className="vs">VS</div>
        <div className="score-item">
          <div className="player-name">{gameState.players.right || "Waiting..."}</div>
          <div className="score">{gameState.scores.right}</div>
        </div>
      </div>

      <div className="game-info">
        <div className="role">
          You are: <strong>{side === "spectator" ? "Spectator" : `Player ${side}`}</strong>
        </div>
        {gameState.status === "waiting" && (
          <div className="waiting-message">Waiting for players...</div>
        )}
      </div>

      <Stage width={WIDTH} height={HEIGHT} className="game-stage">
        <Layer>
          <Rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="#1a1a2e" />

          <Line
            points={[WIDTH / 2, 0, WIDTH / 2, HEIGHT]}
            stroke="#16213e"
            strokeWidth={4}
            dash={[10, 10]}
          />

          <Rect
            x={PADDLE_X_LEFT}
            y={renderedState.paddles.leftY}
            width={PADDLE_W}
            height={PADDLE_H}
            fill="#0f3460"
            cornerRadius={6}
          />

          <Rect
            x={PADDLE_X_RIGHT}
            y={renderedState.paddles.rightY}
            width={PADDLE_W}
            height={PADDLE_H}
            fill="#e94560"
            cornerRadius={6}
          />

          <Circle
            x={renderedState.ball.x}
            y={renderedState.ball.y}
            radius={BALL_R}
            fill="#ffffff"
            shadowBlur={10}
            shadowColor="#ffffff"
          />
        </Layer>
      </Stage>

      <div className="share-section">
        <div className="share-label">Share this game:</div>
        <div className="share-link-container">
          <input
            type="text"
            value={shareUrl}
            readOnly
            className="share-input"
            onClick={(e) => e.currentTarget.select()}
          />
          <button
            className="copy-button"
            onClick={() => {
              navigator.clipboard.writeText(shareUrl);
            }}
          >
            Copy
          </button>
        </div>
      </div>

      {side !== "spectator" && (
        <div className="controls-hint">Use ↑ ↓ arrow keys to move your paddle</div>
      )}
    </div>
  );
}

function App() {
  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);
  const roomId = getRoomFromURL();

  if (!joined) {
    return (
      <div className="join-container">
        <h1>Zocket Ping Pong</h1>
        <p className="subtitle">Real-time multiplayer powered by Zocket</p>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter" && username.trim()) {
              setJoined(true);
            }
          }}
          placeholder="Enter your username..."
          className="username-input"
          autoFocus
        />
        <button
          onClick={() => username.trim() && setJoined(true)}
          className="join-button"
          disabled={!username.trim()}
        >
          Join Game
        </button>
      </div>
    );
  }

  return (
    <ZocketProvider<GameRouter>
      url="ws://localhost:3000"
      headers={{ user: username }}
      debug={true}
      onOpen={() => console.log("Connected to server")}
      onClose={() => console.log("Disconnected from server")}
    >
      <GameCanvas username={username} roomId={roomId} />
    </ZocketProvider>
  );
}

export default App;
