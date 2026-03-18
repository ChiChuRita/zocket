import { createClient } from "@zocket/client";
import { createZocketReact } from "@zocket/react";
import type { app } from "../game";

export const client = createClient<typeof app>({
  url: "ws://localhost:3001",
});

export const {
  ZocketProvider,
  useClient,
  useActor,
  useEvent,
  useActorState,
} = createZocketReact<typeof app>();
