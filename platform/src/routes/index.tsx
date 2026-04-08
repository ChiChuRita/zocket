import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "../components/ui/badge";
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
import { requireWorkOsUser } from "../lib/auth";
import { projectsQueryOptions } from "../lib/platform-queries";
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
        <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
        <span className="text-sm">Loading projects...</span>
      </div>
    );
  }

  if (!session.workosUser?.email) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p>Sign in to load your projects.</p>
        </CardContent>
      </Card>
    );
  }

  const data = projectsQuery.data;
  const projects = data?.projects ?? [];
  const runningProjects = projects.filter((entry) => entry.activeDeployment).length;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            {data?.workspace.name ?? "Workspace"}
          </h1>
          <p className="text-muted-foreground">
            {projects.length === 0
              ? "Create a project, then deploy the first bundle from the Zocket CLI."
              : `${runningProjects} of ${projects.length} project${projects.length !== 1 ? "s" : ""} with active deployments`}
          </p>
        </div>
        <Button asChild>
          <Link to="/projects/new">Create Project</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <CardDescription>Copy the endpoint directly or open a project for deploy details.</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          {projects.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No projects yet</EmptyTitle>
                <EmptyDescription>
                  Create a project in the dashboard, then run `zocket link` and `zocket deploy` from your app directory.
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
                        <div
                          className={`h-2 w-2 rounded-full ${entry.activeDeployment ? "bg-primary" : "bg-muted-foreground/40"}`}
                        />
                        <ItemTitle>{entry.project.name}</ItemTitle>
                      </div>
                      <Badge variant={entry.activeDeployment ? "default" : "secondary"}>
                        {entry.activeDeployment?.status ?? "Not deployed"}
                      </Badge>
                    </ItemHeader>
                    <ItemContent>
                      <ItemDescription>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {`wss://${entry.project.domain}`}
                        </code>
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
