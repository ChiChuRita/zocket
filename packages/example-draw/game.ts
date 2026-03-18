import { z } from "zod";
import { actor, createApp } from "@zocket/core";

// ---------------------------------------------------------------------------
// Word list
// ---------------------------------------------------------------------------

const WORDS = [
  "airplane", "banana", "castle", "dinosaur", "elephant",
  "fireworks", "guitar", "hamburger", "iceberg", "jellyfish",
  "kangaroo", "lighthouse", "mountain", "notebook", "octopus",
  "penguin", "rainbow", "sailboat", "telescope", "umbrella",
  "volcano", "waterfall", "xylophone", "butterfly", "cactus",
  "dragon", "feather", "glasses", "hammer", "island",
  "jacket", "kite", "ladder", "mushroom", "necklace",
  "parachute", "rocket", "snowflake", "treasure", "unicorn",
];

const PLAYER_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateHint(word: string): string {
  return word
    .split("")
    .map((ch) => (ch === " " ? "  " : " _ "))
    .join("")
    .trim();
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const Player = z.object({
  id: z.string(),
  name: z.string(),
  score: z.number(),
  color: z.string(),
  connectionId: z.string().default(""),
});

const Stroke = z.object({
  points: z.array(z.tuple([z.number(), z.number()])),
  color: z.string(),
  width: z.number(),
});

const Guess = z.object({
  playerId: z.string(),
  name: z.string(),
  text: z.string(),
  correct: z.boolean(),
});

const CorrectGuessEvent = z.object({
  name: z.string(),
  word: z.string(),
});

// ---------------------------------------------------------------------------
// Actor
// ---------------------------------------------------------------------------

export const DrawingRoom = actor({
  state: z.object({
    players: z.array(Player).default([]),
    phase: z.enum(["lobby", "drawing", "roundEnd"]).default("lobby"),
    drawerId: z.string().default(""),
    word: z.string().default(""),
    hint: z.string().default(""),
    strokes: z.array(Stroke).default([]),
    guesses: z.array(Guess).default([]),
    round: z.number().default(0),
    maxRounds: z.number().default(3),
  }),

  methods: {
    join: {
      input: z.object({ name: z.string() }),
      handler: async ({ state, input, connectionId }) => {
        const existing = state.players.find((p) => p.name === input.name);
        if (existing) {
          existing.connectionId = connectionId;
          return { playerId: existing.id, color: existing.color };
        }

        const playerId = generateId();
        const color = PLAYER_COLORS[state.players.length % PLAYER_COLORS.length];
        state.players.push({ id: playerId, name: input.name, score: 0, color, connectionId });
        return { playerId, color };
      },
    },

    startRound: {
      handler: async ({ state }) => {
        if (state.players.length < 2) {
          throw new Error("Need at least 2 players to start");
        }

        state.round += 1;
        state.strokes = [];
        state.guesses = [];

        const drawerIndex = (state.round - 1) % state.players.length;
        state.drawerId = state.players[drawerIndex].id;

        const word = pickRandom(WORDS);
        state.word = word;
        state.hint = generateHint(word);
        state.phase = "drawing";

        return { round: state.round, drawerId: state.drawerId };
      },
    },

    draw: {
      input: z.object({ stroke: Stroke }),
      handler: async ({ state, input }) => {
        if (state.phase !== "drawing") return;
        state.strokes.push(input.stroke);
      },
    },

    guess: {
      input: z.object({ playerId: z.string(), text: z.string() }),
      handler: async ({ state, input, emit }) => {
        if (state.phase !== "drawing") return { correct: false };
        if (input.playerId === state.drawerId) return { correct: false };

        const player = state.players.find((p) => p.id === input.playerId);
        if (!player) return { correct: false };

        const correct =
          input.text.trim().toLowerCase() === state.word.toLowerCase();

        state.guesses.push({
          playerId: input.playerId,
          name: player.name,
          text: correct ? "Guessed correctly!" : input.text,
          correct,
        });

        if (correct) {
          player.score += 10;
          const drawer = state.players.find((p) => p.id === state.drawerId);
          if (drawer) drawer.score += 5;

          emit("correctGuess", { name: player.name, word: state.word });

          state.phase = "roundEnd";
        }

        return { correct };
      },
    },

    clearCanvas: {
      handler: async ({ state }) => {
        if (state.phase !== "drawing") return;
        state.strokes = [];
      },
    },

    nextRound: {
      handler: async ({ state }) => {
        if (state.round >= state.maxRounds) {
          state.phase = "lobby";
          state.round = 0;
          state.word = "";
          state.hint = "";
          state.drawerId = "";
          state.strokes = [];
          state.guesses = [];
          for (const p of state.players) p.score = 0;
          return { done: true };
        }
        return { done: false };
      },
    },
  },

  events: {
    correctGuess: CorrectGuessEvent,
  },

  onDisconnect({ state, connectionId }) {
    const idx = state.players.findIndex((p) => p.connectionId === connectionId);
    if (idx === -1) return;

    const wasDrawer = state.players[idx].id === state.drawerId;
    state.players.splice(idx, 1);

    if (wasDrawer && state.phase === "drawing") {
      state.phase = "lobby";
      state.word = "";
      state.hint = "";
      state.drawerId = "";
      state.strokes = [];
      state.guesses = [];
    }
  },
});

export const app = createApp({ actors: { draw: DrawingRoom } });
