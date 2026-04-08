import type { PropsWithChildren } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Button } from "./ui/button";
import { Card, CardHeader, CardTitle } from "./ui/card";
import { useSession } from "../lib/session";

export function AppShell(props: PropsWithChildren) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const session = useSession();
  const displayName = session.workosUser?.email ?? "Signed in";

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <p>Zocket Platform</p>
            <CardTitle>Hosted MVP Control Plane</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {session.workosUser?.email ? (
              <>
                <span>{displayName}</span>
                <Button variant="ghost" onClick={() => void session.signOut()}>
                  Sign out
                </Button>
              </>
            ) : (
              <Button asChild variant={pathname === "/signin" ? "secondary" : "default"}>
                <Link to="/signin">Sign in</Link>
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>
      <main className="flex flex-col gap-6">{props.children}</main>
    </div>
  );
}
