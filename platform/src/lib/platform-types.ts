export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
};

export type ProjectRecord = {
  id: string;
  name: string;
  slug: string;
  domain: string;
  activeDeploymentId: string | null;
};

export type DeploymentRecord = {
  id: string;
  version: string;
  status: string;
  actorTypes: string[];
  runtimeMessage: string | null;
};

export type ProjectAuthConfigRecord = {
  id: string;
  mode: string;
  jwtSecret: string | null;
  jwksUrl: string | null;
  issuer: string | null;
  audience: string | null;
};

export type RuntimeConfigRecord = {
  id: string;
  workspaceId: string;
  projectId: string;
  runtimeApiUrl: string | null;
  gatewayBaseUrl: string | null;
  desiredStatus: string | null;
};

export type ProjectSummary = {
  workspace: WorkspaceSummary;
  project: ProjectRecord;
  activeDeployment: DeploymentRecord | null;
  authConfig: ProjectAuthConfigRecord | null;
  runtimeConfig: RuntimeConfigRecord | null;
  latestDeployment: DeploymentRecord | null;
};

export type ProjectsResponse = {
  workspace: WorkspaceSummary;
  projects: ProjectSummary[];
};

export type CreateProjectResponse = {
  summary: ProjectSummary;
  deployToken: string;
};

export type CreateDeployTokenResponse = {
  deployToken: {
    id: string;
    projectId: string;
    name: string;
  };
  token: string;
};
