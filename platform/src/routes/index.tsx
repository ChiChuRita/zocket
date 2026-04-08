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
    return <div>Loading projects…</div>;
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
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>{data?.workspace.name ?? "Workspace"}</CardTitle>
            <CardDescription>
              {projects.length === 0
                ? "Create a project, then deploy the first bundle from the Zocket CLI."
                : `${runningProjects} of ${projects.length} projects currently have an active deployment.`}
            </CardDescription>
          </div>
          <Button asChild>
            <Link to="/projects/new">Create Project</Link>
          </Button>
        </CardHeader>
      </Card>

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
                      <ItemTitle>{entry.project.name}</ItemTitle>
                      <Badge>{entry.activeDeployment?.status ?? "Not deployed"}</Badge>
                    </ItemHeader>
                    <ItemContent>
                      <ItemDescription>{entry.project.domain}</ItemDescription>
                      <ItemDescription>{`wss://${entry.project.domain}`}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Button asChild variant="outline">
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
