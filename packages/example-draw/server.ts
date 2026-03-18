import { serve } from "@zocket/server/bun";
import { app } from "./game";

const server = serve(app, { port: 3001 });
console.log(`Zocket server on ws://localhost:${server.port}`);
