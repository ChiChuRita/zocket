import { actor, createApp } from "@zocket/core";
import { z } from "zod";

// A tiny vocabulary. The drawer gets one of these at random each round.
const WORDS = [
  "cat", "pizza", "robot", "banana", "guitar",
  "rocket", "dragon", "pirate", "castle", "cactus",
];

// Server-private words, keyed by the drawer's clientId. We keep this out
// of the actor state so it never gets broadcast to the other players.
const secretByDrawer = new Map<string, string>();

function pickWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)]!;
}

function maskWord(word: string) {
  return word.replace(/\S/g, "_").split("").join(" ");
}

const room = actor({
  state: z.object({
    players: z
      .array(z.object({ id: z.string(), name: z.string(), score: z.number() }))
      .default([]),
    phase: z.enum(["lobby", "drawing", "roundOver"]).default("lobby"),
    drawerId: z.string().nullable().default(null),
    hint: z.string().nullable().default(null),        // masked word, e.g. "_ _ _"
    lastWord: z.string().nullable().default(null),    // revealed after round
    winnerId: z.string().nullable().default(null),
  }),

  events: {
    stroke: z.object({
      x0: z.number(), y0: z.number(),
      x1: z.number(), y1: z.number(),
    }),
    clear: z.object({}),
    chat: z.object({ from: z.string(), text: z.string() }),
    correct: z.object({ guesser: z.string(), word: z.string() }),
  },

  onDisconnect: ({ state, clientId }) => {
    state.players = state.players.filter((p) => p.id !== clientId);
    if (state.drawerId === clientId) {
      secretByDrawer.delete(clientId);
      state.drawerId = null;
      state.hint = null;
      state.phase = "lobby";
    }
  },

  methods: {
    // Join the room with a display name.
    join: {
      input: z.object({ name: z.string().min(1).max(20) }),
      handler: ({ state, input, clientId }) => {
        if (!state.players.find((p) => p.id === clientId)) {
          state.players.push({ id: clientId, name: input.name, score: 0 });
        }
      },
    },

    // The caller volunteers to be the drawer. Returns the secret word to them only.
    startRound: {
      handler: ({ state, clientId }) => {
        if (state.phase === "drawing") throw new Error("round already in progress");
        if (!state.players.find((p) => p.id === clientId)) {
          throw new Error("join first");
        }
        const word = pickWord();
        secretByDrawer.set(clientId, word);
        state.drawerId = clientId;
        state.phase = "drawing";
        state.hint = maskWord(word);
        state.lastWord = null;
        state.winnerId = null;
        return { word };
      },
    },

    // The drawer pushes a line segment; server broadcasts to every subscriber.
    stroke: {
      input: z.object({
        x0: z.number(), y0: z.number(),
        x1: z.number(), y1: z.number(),
      }),
      handler: ({ state, input, clientId, emit }) => {
        if (state.drawerId !== clientId) return;
        emit("stroke", input).broadcast();
      },
    },

    clearCanvas: {
      handler: ({ state, clientId, emit }) => {
        if (state.drawerId !== clientId) return;
        emit("clear", {}).broadcast();
      },
    },

    // Non-drawers guess. Correct guess ends the round and awards points.
    guess: {
      input: z.object({ text: z.string().min(1).max(40) }),
      handler: ({ state, input, clientId, emit }) => {
        if (state.phase !== "drawing") return { correct: false };
        if (state.drawerId === clientId) return { correct: false };
        const guesser = state.players.find((p) => p.id === clientId);
        if (!guesser) return { correct: false };

        const word = secretByDrawer.get(state.drawerId ?? "");
        const guess = input.text.trim().toLowerCase();

        if (word && guess === word.toLowerCase()) {
          guesser.score += 3;
          const drawer = state.players.find((p) => p.id === state.drawerId);
          if (drawer) drawer.score += 1;
          secretByDrawer.delete(state.drawerId!);
          state.phase = "roundOver";
          state.lastWord = word;
          state.winnerId = clientId;
          state.hint = null;
          state.drawerId = null;
          emit("correct", { guesser: guesser.name, word }).broadcast();
          return { correct: true };
        }

        emit("chat", { from: guesser.name, text: input.text }).broadcast();
        return { correct: false };
      },
    },
  },
});

export const app = createApp({ actors: { room } });
