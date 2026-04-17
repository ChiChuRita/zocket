import { serve } from "@zocket/server/bun";
import { app } from "./actors";

const port = Number(process.env.PORT ?? 3000);
const server = serve(app, { port });

console.log(`counter example listening on ws://127.0.0.1:${server.port}`);
