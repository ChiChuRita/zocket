import type { PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { AuthKitProvider } from "@workos/authkit-tanstack-react-start/client";
import "../styles/app.css";
import { AppShell } from "../components/app-shell";
import { getQueryClient } from "../lib/query-client";
import { SessionProvider } from "../lib/session";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const queryClient = getQueryClient();

  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <AuthKitProvider>
          <SessionProvider>
            <AppShell>
              <Outlet />
            </AppShell>
          </SessionProvider>
        </AuthKitProvider>
      </QueryClientProvider>
    </RootDocument>
  );
}

function RootDocument(props: PropsWithChildren) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {props.children}
        <Scripts />
      </body>
    </html>
  );
}
