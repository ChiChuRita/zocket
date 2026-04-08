import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemHeader,
  ItemSeparator,
  ItemTitle,
} from "../components/ui/item";
import { Separator } from "../components/ui/separator";
import { requireWorkOsUser } from "../lib/auth";
import { getApi, readApiData } from "../lib/api";
import { projectBySlugQueryOptions } from "../lib/platform-queries";
import type { CreateDeployTokenResponse } from "../lib/platform-types";
import { useSession } from "../lib/session";

export const Route = createFileRoute("/projects/$slug")({
  loader: async ({ params }) => {
    await requireWorkOsUser(`/projects/${params.slug}`);
    return null;
  },
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { slug } = Route.useParams();
  const session = useSession();
  const projectQuery = useQuery({
    ...projectBySlugQueryOptions(slug),
    enabled: session.ready && !!session.workosUser?.email,
  });
  const createDeployTokenMutation = useMutation({
    mutationFn: async () => {
      const project = projectQuery.data?.project;
      if (!project || !session.workosUser?.email) {
        throw new Error("Project is not ready");
      }

      return readApiData<CreateDeployTokenResponse>(
        getApi()["project-ids"]({ projectId: project.id })["deploy-tokens"].post({
          name: `Dashboard token ${new Date().toISOString()}`,
        }),
      );
    },
  });

  if (!session.ready) {
    return <p>Loading project…</p>;
  }

  if (!session.workosUser?.email) {
    return <p>Sign in to view project details.</p>;
  }

  if (projectQuery.isLoading) {
    return <div>Loading project…</div>;
  }

  const project = projectQuery.data?.project ?? null;
  const tokenPreview = createDeployTokenMutation.data?.token ?? null;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <CardTitle>{project?.name ?? slug}</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{project?.domain ?? "loading"}</Badge>
            </div>
          </div>
          <CardDescription>
            Stable project domain and deployment target for your Zocket app.
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          <Alert>
            <AlertTitle>{project?.activeDeploymentId ? "Deployed" : "Not deployed yet"}</AlertTitle>
            <AlertDescription>
              {project?.activeDeploymentId
                ? `Connect clients to wss://${project.domain} and deploy new bundles from the Zocket CLI.`
                : `This project has a stable domain at wss://${project?.domain ?? slug}. Run zocket link and zocket deploy to upload the first bundle.`}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connect</CardTitle>
          <CardDescription>Use the stable domain below from clients and the CLI.</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          <ItemGroup>
            <Item variant="outline">
              <ItemHeader>
                <ItemTitle>WebSocket endpoint</ItemTitle>
              </ItemHeader>
              <ItemContent>
                <ItemDescription>{`wss://${project?.domain ?? slug}`}</ItemDescription>
              </ItemContent>
            </Item>
            <ItemSeparator />
            <Item variant="outline">
              <ItemHeader>
                <ItemTitle>Project domain</ItemTitle>
              </ItemHeader>
              <ItemContent>
                <ItemDescription>{project?.domain ?? slug}</ItemDescription>
              </ItemContent>
            </Item>
            <ItemSeparator />
            <Item variant="outline">
              <ItemHeader>
                <ItemTitle>Deploy with CLI</ItemTitle>
              </ItemHeader>
              <ItemContent>
                <ItemDescription>
                  Run `zocket link`, then `zocket deploy` from your app directory.
                </ItemDescription>
              </ItemContent>
            </Item>
          </ItemGroup>
        </CardContent>
        <CardFooter>
          <Button
            disabled={!project || createDeployTokenMutation.isPending}
            onClick={() => createDeployTokenMutation.mutate()}
          >
            {createDeployTokenMutation.isPending ? "Creating Deploy Token..." : "Create Deploy Token"}
          </Button>
        </CardFooter>
      </Card>

      {tokenPreview ? (
        <Card>
          <CardHeader>
            <CardTitle>Deploy Token</CardTitle>
            <CardDescription>Copy this now. It is only shown once.</CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <code className="block overflow-x-auto rounded-md border p-3">{tokenPreview}</code>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
