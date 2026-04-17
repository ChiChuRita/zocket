import type { PropsWithChildren } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  RiArrowRightUpLine,
  RiLogoutBoxRLine,
  RiMoonClearLine,
  RiSunLine,
} from "@remixicon/react";

import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useTheme } from "./theme-provider";
import { useSession } from "../lib/session";

const AUTH_ROUTES = new Set(["/signin", "/verify"]);

export function AppShell(props: PropsWithChildren) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (AUTH_ROUTES.has(pathname)) {
    return <div className="relative min-h-screen">{props.children}</div>;
  }

  return (
    <div className="relative min-h-screen">
      <AppHeader pathname={pathname} />
      <main className="mx-auto w-full max-w-6xl px-6 py-10 sm:py-12">
        {props.children}
      </main>
    </div>
  );
}

function AppHeader({ pathname }: { pathname: string }) {
  const session = useSession();
  const hasSession = Boolean(session.workosUser?.email);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
          >
            <span className="flex size-7 items-center justify-center rounded-xl bg-primary font-heading text-sm font-bold text-primary-foreground">
              Z
            </span>
            <span className="font-heading text-base font-semibold tracking-tight">
              Zocket
            </span>
          </Link>
          {hasSession ? (
            <nav className="hidden items-center gap-1 sm:flex">
              <NavLink to="/" current={pathname === "/"} label="Dashboard" />
              <a
                href="https://zocket.io/getting-started/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Docs
                <RiArrowRightUpLine className="size-3.5" aria-hidden />
              </a>
            </nav>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {hasSession ? (
            <UserMenu email={session.workosUser!.email ?? ""} onSignOut={() => void session.signOut()} />
          ) : (
            <Button asChild size="sm">
              <Link to="/signin">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({
  to,
  current,
  label,
}: {
  to: "/";
  current: boolean;
  label: string;
}) {
  return (
    <Link
      to={to}
      className={
        "rounded-full px-3 py-1.5 text-sm font-medium transition-colors " +
        (current
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground")
      }
    >
      {label}
    </Link>
  );
}

function ThemeToggle() {
  const { resolved, toggle } = useTheme();
  const isDark = resolved === "dark";
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <RiSunLine aria-hidden /> : <RiMoonClearLine aria-hidden />}
    </Button>
  );
}

function UserMenu({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const initial = email.charAt(0).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2.5 pr-2 pl-1">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
            {initial}
          </span>
          <span className="hidden max-w-[12rem] truncate text-sm text-muted-foreground sm:inline">
            {email}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut}>
          <RiLogoutBoxRLine aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
