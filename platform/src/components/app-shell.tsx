import type { PropsWithChildren } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Button } from "./ui/button";
import { useSession } from "../lib/session";

export function AppShell(props: PropsWithChildren) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const session = useSession();
  const displayName = session.workosUser?.email ?? "Signed in";

  return (
    <div className="relative min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <span className="font-heading text-sm font-bold text-primary-foreground">Z</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-heading text-lg font-semibold tracking-tight">Zocket</span>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Platform
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            {session.workosUser?.email ? (
              <>
                <span className="hidden text-sm text-muted-foreground sm:inline">{displayName}</span>
                <Button variant="ghost" size="sm" onClick={() => void session.signOut()}>
                  Sign out
                </Button>
              </>
            ) : (
              <Button asChild size="sm" variant={pathname === "/signin" ? "secondary" : "default"}>
                <Link to="/signin">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-6 py-8">{props.children}</main>
    </div>
  );
}
