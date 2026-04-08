import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
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
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary">
            <span className="font-heading text-xl font-bold text-primary-foreground">Z</span>
          </div>
          <h1 className="font-heading text-xl font-bold tracking-tight">Approve CLI Session</h1>
        </div>
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Device verification</CardTitle>
            <CardDescription>
              Device code:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{deviceCode ?? "missing"}</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="text-foreground">{session.workosUser?.email ?? "unknown user"}</span>
            </p>
            {status ? <p className="text-sm text-primary">{status}</p> : null}
          </CardContent>
          <CardFooter>
            <Button
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
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
