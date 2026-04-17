import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "../components/ui/button";
import { CodeChip } from "../components/ui/code-chip";
import { AuthShell } from "../components/auth-shell";
import { requireWorkOsUser } from "../lib/auth";
import { useSession } from "../lib/session";

export const Route = createFileRoute("/verify")({
  loader: async () => {
    await requireWorkOsUser("/verify");
    return null;
  },
  component: VerifyPage,
});

function VerifyPage() {
  const session = useSession();
  const deviceCode =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("deviceCode") ?? undefined
      : undefined;
  const [status, setStatus] = useState<string | null>(null);

  return (
    <AuthShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Approve CLI Session
          </h1>
          <p className="text-sm text-muted-foreground">
            Confirm this device code matches what the terminal shows, then approve.
          </p>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
              Device code
            </p>
            <CodeChip
              value={deviceCode ?? "missing"}
              className="text-base py-2 px-4 rounded-xl font-mono"
            />
          </div>

          <p className="text-sm text-muted-foreground">
            Signed in as{" "}
            <span className="text-foreground font-medium">
              {session.workosUser?.email ?? "unknown user"}
            </span>
          </p>

          {status ? (
            <p className="rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm text-primary">
              {status}
            </p>
          ) : null}
        </div>

        <Button
          size="lg"
          className="w-full"
          disabled={!deviceCode || !session.workosUser?.email}
          onClick={async () => {
            if (!deviceCode) return;
            await session.approveDeviceFlow(deviceCode);
            setStatus("CLI session approved. You can return to the terminal.");
          }}
        >
          Approve CLI Session
        </Button>
      </div>
    </AuthShell>
  );
}
