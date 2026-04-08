import { queryOptions } from "@tanstack/react-query";
import { getApi, readApiData } from "./api";
import type { ProjectSummary, ProjectsResponse } from "./platform-types";

export function projectsQueryOptions() {
  return queryOptions({
    queryKey: ["projects"],
    queryFn: async (): Promise<ProjectsResponse> =>
      readApiData<ProjectsResponse>(getApi().projects.get()),
  });
}

export function projectBySlugQueryOptions(slug: string) {
  return queryOptions({
    queryKey: ["project", slug],
    queryFn: async (): Promise<ProjectSummary> =>
      readApiData<ProjectSummary>(getApi()["project-slugs"]({ slug }).get()),
  });
}
