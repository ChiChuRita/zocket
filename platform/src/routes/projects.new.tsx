import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
} from "../components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../components/ui/field";
import { Input } from "../components/ui/input";
import { PageHeader } from "../components/page-header";
import { requireWorkOsUser } from "../lib/auth";
import { getApi, readApiData } from "../lib/api";
import type { CreateProjectResponse } from "../lib/platform-types";
import { useSession } from "../lib/session";

export const Route = createFileRoute("/projects/new")({
  loader: async () => {
    await requireWorkOsUser("/projects/new");
    return null;
  },
  component: NewProjectPage,
});

function NewProjectPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const createProjectMutation = useMutation({
    mutationFn: async () => {
      if (!session.workosUser?.email) {
        throw new Error("Sign in first");
      }

      return readApiData<CreateProjectResponse>(
        getApi().projects.post({
          name,
          slug: slug || undefined,
        }),
      );
    },
    onSuccess: async (result: CreateProjectResponse) => {
      await navigate({ to: "/projects/$slug", params: { slug: result.summary.project.slug } });
    },
  });

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", to: "/" },
          { label: "New project" },
        ]}
        title="Create project"
        description="Name your project and link the CLI to start deploying."
      />

      <Card className="max-w-xl">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            createProjectMutation.reset();
            await createProjectMutation.mutateAsync();
          }}
        >
          <CardContent className="pt-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="project-name">Name</FieldLabel>
                <Input
                  id="project-name"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <FieldDescription>Displayed in the dashboard.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="project-slug">Slug</FieldLabel>
                <Input
                  id="project-slug"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                />
                <FieldDescription>Optional. Leave blank to generate one automatically.</FieldDescription>
              </Field>
              {createProjectMutation.error ? (
                <FieldError>{createProjectMutation.error.message ?? "Project creation failed"}</FieldError>
              ) : null}
            </FieldGroup>
          </CardContent>
          <CardFooter className="gap-3">
            <Button type="submit" disabled={createProjectMutation.isPending}>
              {createProjectMutation.isPending ? "Creating..." : "Create Project"}
            </Button>
            <Button type="button" variant="ghost" asChild>
              <a href="/">Cancel</a>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
