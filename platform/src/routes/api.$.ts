import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "@workos/authkit-tanstack-react-start";
import { app } from "../server/api/app";

async function handle({ request }: { request: Request }) {
  const auth = await getAuth();
  const headers = new Headers(request.headers);

  if (auth.user?.id && auth.user.email) {
    headers.set("x-zocket-workos-user-id", auth.user.id);
    headers.set("x-zocket-workos-user-email", auth.user.email);
    headers.set(
      "x-zocket-workos-user-name",
      [auth.user.firstName, auth.user.lastName].filter(Boolean).join(" ") ||
        auth.user.email.split("@")[0] ||
        "User",
    );
  }

  return await app.fetch(
    new Request(request, {
      headers,
    }),
  );
}

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
      PUT: handle,
      PATCH: handle,
      DELETE: handle,
      OPTIONS: handle,
    },
  },
});
