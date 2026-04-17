import { actor, createApp } from "../core/src/index";
import { serve } from "../server/src/bun";
import { z } from "zod";

const PORT = Number(Bun.env.PORT ?? 3000);
const WORD_BANK = [
  "rocket",
  "volcano",
  "banana",
  "castle",
  "dragon",
  "guitar",
  "helmet",
  "jungle",
  "meteor",
  "pirate",
  "rainbow",
  "submarine",
] as const;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const now = () => Date.now();

const createId = () => crypto.randomUUID();

const PointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

const StrokeSchema = z.object({
  id: z.string(),
  color: z.string(),
  width: z.number(),
  points: z.array(PointSchema).min(1),
});

const PlayerSchema = z.object({
  connectionId: z.string(),
  name: z.string(),
  color: z.string(),
  score: z.number(),
  online: z.boolean(),
  lastSeenAt: z.number(),
});

const GuessSchema = z.object({
  id: z.string(),
  by: z.string(),
  text: z.string(),
  correct: z.boolean(),
  at: z.number(),
});

const GameStateSchema = z.object({
  phase: z.enum(["lobby", "drawing", "revealed"]).default("lobby"),
  round: z.number().default(0),
  drawerConnectionId: z.string().nullable().default(null),
  drawerName: z.string().nullable().default(null),
  maskedWord: z.string().default(""),
  revealedWord: z.string().nullable().default(null),
  winnerConnectionId: z.string().nullable().default(null),
  players: z.array(PlayerSchema).default([]),
  strokes: z.array(StrokeSchema).default([]),
  guesses: z.array(GuessSchema).default([]),
  updatedAt: z.number().default(0),
});

type GameState = z.infer<typeof GameStateSchema>;
export type ExampleGameState = GameState;
export type ExampleStroke = z.infer<typeof StrokeSchema>;
export type ExamplePlayer = z.infer<typeof PlayerSchema>;
export type ExampleGuess = z.infer<typeof GuessSchema>;

const hiddenRound = {
  word: null as string | null,
  drawerConnectionId: null as string | null,
  lastWord: null as string | null,
};

function normalize(text: string) {
  return text.trim().toLowerCase();
}

function maskWord(word: string) {
  return word
    .split("")
    .map((char) => (/[a-z]/i.test(char) ? "_" : char))
    .join(" ");
}

function pickWord() {
  const candidates = WORD_BANK.filter((word) => word !== hiddenRound.lastWord);
  const pool = candidates.length > 0 ? candidates : WORD_BANK;
  const word = pool[Math.floor(Math.random() * pool.length)];
  hiddenRound.lastWord = word;
  return word;
}

function getPlayer(state: GameState, connectionId: string) {
  return state.players.find((player) => player.connectionId === connectionId);
}

function ensurePlayer(
  state: GameState,
  connectionId: string,
  next?: Partial<Pick<ExamplePlayer, "name" | "color" | "online">>,
) {
  const existing = getPlayer(state, connectionId);
  if (existing) {
    if (next?.name) existing.name = next.name;
    if (next?.color) existing.color = next.color;
    if (typeof next?.online === "boolean") existing.online = next.online;
    existing.lastSeenAt = now();
    return existing;
  }

  const player = {
    connectionId,
    name: next?.name ?? `Player ${connectionId.slice(-4)}`,
    color: next?.color ?? "#F97316",
    score: 0,
    online: next?.online ?? true,
    lastSeenAt: now(),
  };
  state.players.push(player);
  return player;
}

function onlinePlayers(state: GameState) {
  return state.players.filter((player) => player.online);
}

function nameFor(state: GameState, connectionId: string) {
  return getPlayer(state, connectionId)?.name ?? `Player ${connectionId.slice(-4)}`;
}

function chooseNextDrawer(state: GameState) {
  const candidates = onlinePlayers(state);
  if (candidates.length < 2) return null;

  if (!state.drawerConnectionId) {
    return candidates[0];
  }

  const currentIndex = candidates.findIndex(
    (player) => player.connectionId === state.drawerConnectionId,
  );
  if (currentIndex === -1) return candidates[0];
  return candidates[(currentIndex + 1) % candidates.length];
}

function revealRound(
  state: GameState,
  emit: (event: "roundEnded", payload: { winnerName: string | null; word: string; reason: "guessed" | "drawer-left" | "restarted"; }) => void,
  reason: "guessed" | "drawer-left" | "restarted",
  winnerName: string | null,
) {
  if (!hiddenRound.word) return;

  state.phase = "revealed";
  state.revealedWord = hiddenRound.word;
  state.maskedWord = maskWord(hiddenRound.word);
  state.updatedAt = now();
  emit("roundEnded", {
    winnerName,
    word: hiddenRound.word,
    reason,
  });
  hiddenRound.word = null;
  hiddenRound.drawerConnectionId = null;
}

export const game = actor({
  state: GameStateSchema,
  onConnect: ({ state, connectionId, emit }) => {
    const player = ensurePlayer(state, connectionId, { online: true });
    state.updatedAt = now();
    emit("presenceChanged", {
      name: player.name,
      online: true,
    });
  },
  onDisconnect: ({ state, connectionId, emit }) => {
    const player = getPlayer(state, connectionId);
    if (!player) return;

    player.online = false;
    player.lastSeenAt = now();
    state.updatedAt = now();
    emit("presenceChanged", {
      name: player.name,
      online: false,
    });

    if (hiddenRound.drawerConnectionId === connectionId && hiddenRound.word) {
      revealRound(state, emit, "drawer-left", null);
    }
  },
  methods: {
    identify: {
      input: z.object({
        name: z.string().trim().min(1).max(24),
        color: z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/),
      }),
      handler: ({ state, input, connectionId, emit }) => {
        const player = ensurePlayer(state, connectionId, {
          name: input.name,
          color: input.color,
          online: true,
        });
        state.updatedAt = now();
        emit("presenceChanged", {
          name: player.name,
          online: true,
        });

        return {
          player,
          onlineCount: onlinePlayers(state).length,
        };
      },
    },
    startRound: {
      handler: ({ state, emit, connectionId }) => {
        const nextDrawer = chooseNextDrawer(state);
        if (!nextDrawer) {
          return {
            ok: false as const,
            reason: "need-two-players" as const,
          };
        }

        if (hiddenRound.word) {
          revealRound(state, emit, "restarted", null);
        }

        const word = pickWord();
        hiddenRound.word = word;
        hiddenRound.drawerConnectionId = nextDrawer.connectionId;

        state.phase = "drawing";
        state.round += 1;
        state.drawerConnectionId = nextDrawer.connectionId;
        state.drawerName = nextDrawer.name;
        state.maskedWord = maskWord(word);
        state.revealedWord = null;
        state.winnerConnectionId = null;
        state.strokes = [];
        state.guesses = [];
        state.updatedAt = now();

        emit("roundStarted", {
          round: state.round,
          drawerName: nextDrawer.name,
          wordLength: word.length,
        });

        return {
          ok: true as const,
          drawerName: nextDrawer.name,
          isDrawer: nextDrawer.connectionId === connectionId,
        };
      },
    },
    peekWord: {
      handler: ({ state, connectionId }) => {
        if (
          state.phase !== "drawing" ||
          connectionId !== state.drawerConnectionId ||
          hiddenRound.drawerConnectionId !== connectionId
        ) {
          return {
            ok: false as const,
            word: null,
          };
        }

        return {
          ok: true as const,
          word: hiddenRound.word,
        };
      },
    },
    addStroke: {
      input: z.object({
        color: z.string(),
        width: z.number().min(1).max(32),
        points: z.array(PointSchema).min(1).max(300),
      }),
      handler: ({ state, input, connectionId, emit }) => {
        if (
          state.phase !== "drawing" ||
          connectionId !== state.drawerConnectionId ||
          hiddenRound.drawerConnectionId !== connectionId
        ) {
          return { ok: false as const };
        }

        state.strokes.push({
          id: createId(),
          color: input.color,
          width: input.width,
          points: input.points.map((point: { x: number; y: number }) => ({
            x: clamp(point.x, 0, 1),
            y: clamp(point.y, 0, 1),
          })),
        });
        state.updatedAt = now();

        emit("strokeCommitted", {
          by: nameFor(state, connectionId),
          count: state.strokes.length,
        });

        return { ok: true as const };
      },
    },
    clearBoard: {
      handler: ({ state, connectionId }) => {
        if (
          state.phase !== "drawing" ||
          connectionId !== state.drawerConnectionId ||
          hiddenRound.drawerConnectionId !== connectionId
        ) {
          return { ok: false as const };
        }

        state.strokes = [];
        state.updatedAt = now();
        return { ok: true as const };
      },
    },
    submitGuess: {
      input: z.object({
        text: z.string().trim().min(1).max(80),
      }),
      handler: ({ state, input, connectionId, emit }) => {
        if (state.phase !== "drawing" || !hiddenRound.word) {
          return { ok: false as const, correct: false as const };
        }

        if (connectionId === state.drawerConnectionId) {
          return { ok: false as const, correct: false as const };
        }

        const player = ensurePlayer(state, connectionId, { online: true });
        const correct = normalize(input.text) === normalize(hiddenRound.word);

        state.guesses.unshift({
          id: createId(),
          by: player.name,
          text: input.text,
          correct,
          at: now(),
        });
        state.guesses = state.guesses.slice(0, 18);
        state.updatedAt = now();

        emit("guessSubmitted", {
          by: player.name,
          text: input.text,
          correct,
        });

        if (correct) {
          player.score += 1;
          state.winnerConnectionId = connectionId;
          revealRound(state, emit, "guessed", player.name);
        }

        return {
          ok: true as const,
          correct,
        };
      },
    },
  },
  events: {
    presenceChanged: z.object({
      name: z.string(),
      online: z.boolean(),
    }),
    roundStarted: z.object({
      round: z.number(),
      drawerName: z.string(),
      wordLength: z.number(),
    }),
    roundEnded: z.object({
      winnerName: z.string().nullable(),
      word: z.string(),
      reason: z.enum(["guessed", "drawer-left", "restarted"]),
    }),
    guessSubmitted: z.object({
      by: z.string(),
      text: z.string(),
      correct: z.boolean(),
    }),
    strokeCommitted: z.object({
      by: z.string(),
      count: z.number(),
    }),
  },
});

export const app = createApp({
  actors: {
    game,
  },
});

export type ExampleApp = typeof app;

const server = serve(app, { port: PORT });

console.log(`zocket example server listening on ws://127.0.0.1:${server.port}`);
