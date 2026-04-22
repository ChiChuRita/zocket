import { createClient } from "@zocket/client";
import { createZocketReact } from "@zocket/react";
import type { app } from "../../actors";

export const wsUrl =
  import.meta.env.VITE_ZOCKET_URL ??
  `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:3000`;

export const client = createClient<typeof app>({
  url: wsUrl,
  reconnect: true,
});

export const zocket = createZocketReact<typeof app>();
