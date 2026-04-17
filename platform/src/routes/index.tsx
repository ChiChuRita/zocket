import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemHeader,
  ItemSeparator,
  ItemTitle,
} from "../components/ui/item";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "../components/ui/empty";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";
import { StatusDot } from "../components/ui/status-dot";
import { CodeChip } from "../components/ui/code-chip";
import { PageHeader } from "../components/page-header";
import { requireWorkOsUser } from "../lib/auth";
import { projectsQueryOptions } from "../lib/platform-queries";
import type { ProjectSummary } from "../lib/platform-types";
import { useSession } from "../lib/session";

export const Route = createFileRoute("/")({
  loader: async () => {
    await requireWorkOsUser("/");
    return null;
  },
  component: DashboardPage,
});

function DashboardPage() {
  const session = useSession();
  const projectsQuery = useQuery({
    ...projectsQueryOptions(),
    enabled: session.ready && !!session.workosUser?.email,
  });

  if (!session.ready || projectsQuery.isLoading) {
    return (
      <div className="flex items-center gap-3 py-16 text-muted-foreground">
        <StatusDot variant="active" size="sm" />
        <span className="text-sm">Loading projects...</span>
      </div>
    );
  }

  if (!session.workosUser?.email) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Sign in to load your projects.</p>
        </CardContent>
      </Card>
    );
  }

  const data = projectsQuery.data as { workspace: { name: string }; projects: ProjectSummary[] } | undefined;
  const projects: ProjectSummary[] = data?.projects ?? [];
  const runningProjects = projects.filter((entry) => entry.activeDeployment).length;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title={data?.workspace.name ?? "Workspace"}
        description={
          projects.length === 0
            ? "Create a project, then deploy the first bundle from the Zocket CLI."
            : `${runningProjects} of ${projects.length} project${projects.length !== 1 ? "s" : ""} with active deployments`
        }
        actions={
          <Button asChild>
            <Link to="/projects/new">Create Project</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <CardDescription>Copy the endpoint or open a project for deploy details.</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          {projects.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No projects yet</EmptyTitle>
                <EmptyDescription>
                  Create a project, then run <code className="font-mono">zocket link</code> and{" "}
                  <code className="font-mono">zocket deploy</code> from your app directory.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild>
                  <Link to="/projects/new">Create Project</Link>
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <ItemGroup>
              {projects.map((entry, index) => (
                <div key={entry.project.id}>
                  <Item variant="outline">
                    <ItemHeader>
                      <div className="flex items-center gap-2.5">
                        <StatusDot
                          variant={entry.activeDeployment ? "active" : "muted"}
                          size="sm"
                        />
                        <ItemTitle>{entry.project.name}</ItemTitle>
                      </div>
                      <Badge variant={entry.activeDeployment ? "default" : "secondary"}>
                        {entry.activeDeployment?.status ?? "Not deployed"}
                      </Badge>
                    </ItemHeader>
                    <ItemContent>
                      <ItemDescription>
                        <CodeChip value={`wss://${entry.project.domain}`} />
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Button asChild variant="outline" size="sm">
                        <Link to="/projects/$slug" params={{ slug: entry.project.slug }}>
                          Open
                        </Link>
                      </Button>
                    </ItemActions>
                  </Item>
                  {index < projects.length - 1 ? <ItemSeparator /> : null}
                </div>
              ))}
            </ItemGroup>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
