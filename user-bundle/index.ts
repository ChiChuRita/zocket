import { actor, setup } from "@zocket/core";
import { z } from "zod";

const counter = actor({
  state: z.object({ count: z.number().default(0) }),
  methods: {
    increment: {
      handler: ({ state }) => {
        state.count++;
        return state.count;
      },
    },
    getCount: {
      handler: ({ state }) => state.count,
    },
  },
});

export const registry = setup({ use: { counter } });
