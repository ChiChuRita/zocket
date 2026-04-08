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
    onSuccess: async (result) => {
      await navigate({ to: "/projects/$slug", params: { slug: result.summary.project.slug } });
    },
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Create project</h1>
        <p className="text-muted-foreground">Create a new project and link your CLI to it.</p>
      </div>
      <Card className="max-w-2xl">
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
                <Input id="project-slug" value={slug} onChange={(event) => setSlug(event.target.value)} />
                <FieldDescription>Optional. Leave blank to generate one automatically.</FieldDescription>
              </Field>
              {createProjectMutation.error ? (
                <FieldError>{createProjectMutation.error.message ?? "Project creation failed"}</FieldError>
              ) : null}
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={createProjectMutation.isPending}>
              {createProjectMutation.isPending ? "Creating Project..." : "Create Project"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
