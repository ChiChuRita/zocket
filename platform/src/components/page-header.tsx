import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { RiArrowRightSLine } from "@remixicon/react";

import { cn } from "~/lib/utils";

interface Crumb {
  label: string;
  to?: string;
}

export interface PageHeaderProps {
  eyebrow?: ReactNode;
  breadcrumbs?: Crumb[];
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  breadcrumbs,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  const hasTop = Boolean(eyebrow || (breadcrumbs && breadcrumbs.length > 0));

  return (
    <header
      className={cn(
        "flex flex-col gap-6 border-b border-border/60 pb-8 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-3">
        {hasTop ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {breadcrumbs?.map((crumb, i) => (
              <span key={`${crumb.label}-${i}`} className="inline-flex items-center gap-2">
                {crumb.to ? (
                  <Link
                    to={crumb.to}
                    className="transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground">{crumb.label}</span>
                )}
                {i < (breadcrumbs?.length ?? 0) - 1 ? (
                  <RiArrowRightSLine className="size-3.5 text-muted-foreground/50" aria-hidden />
                ) : null}
              </span>
            ))}
            {eyebrow ? (
              <span className="font-mono uppercase tracking-[0.18em]">{eyebrow}</span>
            ) : null}
          </div>
        ) : null}

        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-[2rem] sm:leading-[1.15]">
          {title}
        </h1>

        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-[0.95rem]">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
