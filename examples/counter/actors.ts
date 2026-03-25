import { actor, setup } from "@zocket/core";
import { z } from "zod";

const counter = actor({
  state: z.object({
    count: z.number().default(0),
    lastUpdatedBy: z.string().nullable().default(null),
  }),
  methods: {
    increment: {
      handler: ({ state, connectionId }) => {
        state.count++;
        state.lastUpdatedBy = connectionId;
        return state.count;
      },
    },
    decrement: {
      handler: ({ state, connectionId }) => {
        state.count--;
        state.lastUpdatedBy = connectionId;
        return state.count;
      },
    },
    set: {
      input: z.object({ value: z.number() }),
      handler: ({ state, input, connectionId }) => {
        state.count = input.value;
        state.lastUpdatedBy = connectionId;
        return state.count;
      },
    },
  },
});

export const registry = setup({ use: { counter } });
