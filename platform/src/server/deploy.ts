type EnsureProjectRuntimeArgs = {
  deploymentId: string;
  workspaceId: string;
  projectId: string;
  stackName: string;
  desiredStatus?: "idle" | "active";
};

export async function ensureProjectRuntime(args: EnsureProjectRuntimeArgs): Promise<void> {
  throw new Error(
    `Runtime orchestration is not configured in this platform deployment for project ${args.projectId}.`,
  );
}
