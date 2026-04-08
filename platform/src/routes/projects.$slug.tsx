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
    return (
      <div className="flex items-center gap-3 py-16 text-muted-foreground">
        <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
        <span className="text-sm">Loading project...</span>
      </div>
    );
  }

  if (!session.workosUser?.email) {
    return <p className="py-16 text-muted-foreground">Sign in to view project details.</p>;
  }

  if (projectQuery.isLoading) {
    return (
      <div className="flex items-center gap-3 py-16 text-muted-foreground">
        <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
        <span className="text-sm">Loading project...</span>
      </div>
    );
  }

  const project = projectQuery.data?.project ?? null;
  const tokenPreview = createDeployTokenMutation.data?.token ?? null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`h-3 w-3 rounded-full ${project?.activeDeploymentId ? "bg-primary animate-pulse" : "bg-muted-foreground/40"}`}
          />
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            {project?.name ?? slug}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{project?.domain ?? "loading"}</Badge>
          <Badge variant={project?.activeDeploymentId ? "default" : "secondary"}>
            {project?.activeDeploymentId ? "Deployed" : "Not deployed"}
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Stable project domain and deployment target for your Zocket app.
        </p>
      </div>

      <Alert>
        <AlertTitle>{project?.activeDeploymentId ? "Deployed" : "Not deployed yet"}</AlertTitle>
        <AlertDescription>
          {project?.activeDeploymentId
            ? `Connect clients to wss://${project.domain} and deploy new bundles from the Zocket CLI.`
            : `This project has a stable domain at wss://${project?.domain ?? slug}. Run zocket link and zocket deploy to upload the first bundle.`}
        </AlertDescription>
      </Alert>

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
                <ItemDescription>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {`wss://${project?.domain ?? slug}`}
                  </code>
                </ItemDescription>
              </ItemContent>
            </Item>
            <ItemSeparator />
            <Item variant="outline">
              <ItemHeader>
                <ItemTitle>Project domain</ItemTitle>
              </ItemHeader>
              <ItemContent>
                <ItemDescription>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {project?.domain ?? slug}
                  </code>
                </ItemDescription>
              </ItemContent>
            </Item>
            <ItemSeparator />
            <Item variant="outline">
              <ItemHeader>
                <ItemTitle>Deploy with CLI</ItemTitle>
              </ItemHeader>
              <ItemContent>
                <ItemDescription>
                  Run <code className="rounded bg-muted px-1 py-0.5 text-xs">zocket link</code>, then{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">zocket deploy</code> from your app directory.
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
            <code className="block overflow-x-auto rounded-lg border border-primary/20 bg-primary/[0.04] p-4 text-sm">
              {tokenPreview}
            </code>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
