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
import { ThemeProvider } from "../components/theme-provider";
import { getQueryClient } from "../lib/query-client";
import { SessionProvider } from "../lib/session";

const themeInitScript = `
(function(){try{var s=localStorage.getItem('zocket-theme');var d=s==='light'?false:s==='dark'?true:window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){document.documentElement.classList.add('dark');}})();
`.trim();

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const queryClient = getQueryClient();

  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <AuthKitProvider>
          <ThemeProvider>
            <SessionProvider>
              <AppShell>
                <Outlet />
              </AppShell>
            </SessionProvider>
          </ThemeProvider>
        </AuthKitProvider>
      </QueryClientProvider>
    </RootDocument>
  );
}

function RootDocument(props: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {props.children}
        <Scripts />
      </body>
    </html>
  );
}
