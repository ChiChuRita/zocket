import { actor, createApp } from "@zocket/core";
import { z } from "zod";

const counter = actor({
  state: z.object({
    count: z.number().default(0),
    viewers: z.number().default(0),
    lastUpdatedBy: z.string().nullable().default(null),
    updatedAt: z.number().nullable().default(null),
  }),
  events: {
    changed: z.object({
      count: z.number(),
      delta: z.number(),
      action: z.enum(["increment", "decrement", "reset", "set"]),
      changedBy: z.string(),
    }),
    presence: z.object({
      viewers: z.number(),
    }),
  },
  onConnect: ({ state, emit }) => {
    state.viewers += 1;
    emit("presence", { viewers: state.viewers });
  },
  onDisconnect: ({ state, emit }) => {
    state.viewers = Math.max(0, state.viewers - 1);
    emit("presence", { viewers: state.viewers });
  },
  methods: {
    increment: {
      handler: ({ state, connectionId, emit }) => {
        state.count += 1;
        state.lastUpdatedBy = connectionId;
        state.updatedAt = Date.now();
        emit("changed", {
          count: state.count,
          delta: 1,
          action: "increment",
          changedBy: connectionId,
        });
        return state.count;
      },
    },
    decrement: {
      handler: ({ state, connectionId, emit }) => {
        state.count -= 1;
        state.lastUpdatedBy = connectionId;
        state.updatedAt = Date.now();
        emit("changed", {
          count: state.count,
          delta: -1,
          action: "decrement",
          changedBy: connectionId,
        });
        return state.count;
      },
    },
    reset: {
      handler: ({ state, connectionId, emit }) => {
        state.count = 0;
        state.lastUpdatedBy = connectionId;
        state.updatedAt = Date.now();
        emit("changed", {
          count: state.count,
          delta: 0,
          action: "reset",
          changedBy: connectionId,
        });
        return state.count;
      },
    },
    set: {
      input: z.object({ value: z.number() }),
      handler: ({ state, input, connectionId, emit }) => {
        state.count = input.value;
        state.lastUpdatedBy = connectionId;
        state.updatedAt = Date.now();
        emit("changed", {
          count: state.count,
          delta: 0,
          action: "set",
          changedBy: connectionId,
        });
        return state.count;
      },
    },
  },
});

export const app = createApp({ actors: { counter } });
