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
import { Separator } from "../components/ui/separator";
import { StatusDot } from "../components/ui/status-dot";
import { CodeChip } from "../components/ui/code-chip";
import { PageHeader } from "../components/page-header";
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

  if (!session.ready || projectQuery.isLoading) {
    return (
      <div className="flex items-center gap-3 py-16 text-muted-foreground">
        <StatusDot variant="active" size="sm" />
        <span className="text-sm">Loading project...</span>
      </div>
    );
  }

  if (!session.workosUser?.email) {
    return <p className="py-16 text-sm text-muted-foreground">Sign in to view project details.</p>;
  }

  const project = projectQuery.data?.project ?? null;
  const isDeployed = Boolean(project?.activeDeploymentId);
  const tokenPreview = createDeployTokenMutation.data?.token ?? null;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", to: "/" },
          { label: project?.name ?? slug },
        ]}
        title={project?.name ?? slug}
        description="Stable project domain and deployment target for your Zocket app."
        actions={
          <div className="flex items-center gap-2">
            <StatusDot variant={isDeployed ? "active" : "muted"} />
            <Badge variant={isDeployed ? "default" : "secondary"}>
              {isDeployed ? "Deployed" : "Not deployed"}
            </Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2/3: deploy tokens + status */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Alert>
            <AlertTitle>{isDeployed ? "Live" : "Not deployed yet"}</AlertTitle>
            <AlertDescription>
              {isDeployed
                ? `Connect clients to wss://${project!.domain} and deploy new bundles from the Zocket CLI.`
                : `Run zocket link and zocket deploy from your app directory to push the first bundle.`}
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Deploy Token</CardTitle>
              <CardDescription>
                Create a token to authenticate CLI deployments from CI or a local machine.
              </CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
              {tokenPreview ? (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-muted-foreground">
                    Copy this now — it will not be shown again.
                  </p>
                  <CodeChip
                    value={tokenPreview}
                    className="rounded-xl py-2.5 px-4 text-xs"
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No token created yet. Click below to generate one.
                </p>
              )}
            </CardContent>
            <CardFooter>
              <Button
                disabled={!project || createDeployTokenMutation.isPending}
                onClick={() => createDeployTokenMutation.mutate()}
                variant={tokenPreview ? "secondary" : "default"}
              >
                {createDeployTokenMutation.isPending
                  ? "Creating..."
                  : tokenPreview
                    ? "Create Another Token"
                    : "Create Deploy Token"}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Right 1/3: connection info */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Connect</CardTitle>
              <CardDescription>Use these values from clients and the CLI.</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="flex flex-col gap-5 pt-6">
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">WebSocket endpoint</p>
                <CodeChip value={`wss://${project?.domain ?? slug}`} />
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">Domain</p>
                <CodeChip value={project?.domain ?? slug} />
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">Deploy via CLI</p>
                <div className="flex flex-col gap-1">
                  <CodeChip value="zocket link" copyable={false} />
                  <CodeChip value="zocket deploy" copyable={false} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
