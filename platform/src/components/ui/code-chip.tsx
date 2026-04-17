import { useState } from "react";
import { RiCheckLine, RiFileCopyLine } from "@remixicon/react";

import { cn } from "~/lib/utils";

export interface CodeChipProps {
  value: string;
  display?: string;
  className?: string;
  copyable?: boolean;
}

export function CodeChip({ value, display, className, copyable = true }: CodeChipProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard is best-effort
    }
  };

  return (
    <span
      className={cn(
        "group/code inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 font-mono text-xs text-muted-foreground",
        className,
      )}
    >
      <span className="truncate">{display ?? value}</span>
      {copyable ? (
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Copied" : "Copy"}
          className="inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground/70 transition-colors hover:text-foreground"
        >
          {copied ? (
            <RiCheckLine className="size-3.5" aria-hidden />
          ) : (
            <RiFileCopyLine className="size-3.5" aria-hidden />
          )}
        </button>
      ) : null}
    </span>
  );
}
