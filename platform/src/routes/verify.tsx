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
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Approve a local CLI session</CardTitle>
          <CardDescription>Device code: {deviceCode ?? "missing"}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p>Signed in as {session.workosUser?.email ?? "unknown user"}.</p>
          {status ? <p>{status}</p> : null}
        </CardContent>
        <CardFooter>
          <Button
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
  );
}
