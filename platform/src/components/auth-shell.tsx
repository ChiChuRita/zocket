import type { PropsWithChildren, ReactNode } from "react";
import { Link } from "@tanstack/react-router";

interface AuthShellProps extends PropsWithChildren {
  footer?: ReactNode;
}

export function AuthShell({ children, footer }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <Link
        to="/"
        className="absolute left-6 top-6 flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className="flex size-7 items-center justify-center rounded-xl bg-primary text-primary-foreground font-heading text-sm font-bold">
          Z
        </span>
        <span className="font-heading text-base tracking-tight">Zocket</span>
      </Link>

      <div className="w-full max-w-md">{children}</div>

      {footer ? (
        <div className="mt-8 text-center text-xs text-muted-foreground">{footer}</div>
      ) : null}
    </div>
  );
}
