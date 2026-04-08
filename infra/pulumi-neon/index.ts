import * as pulumi from "@pulumi/pulumi";
import * as neon from "@pulumi/neon";

const config = new pulumi.Config("zocket");
const neonOrgId = config.require("neonOrgId");
const regionId = config.get("neonRegionId") ?? "aws-us-east-1";
const projectName = config.get("neonProjectName") ?? "zocket-platform";
const projectBranchName = config.get("neonBranchName") ?? "main";
const databaseName = config.get("neonDatabaseName") ?? "neondb";
const roleName = config.get("neonRoleName") ?? "neondb_owner";
const pgVersion = Number(config.get("neonPgVersion") ?? "17");
const historyRetentionSeconds = Number(config.get("neonHistoryRetentionSeconds") ?? "21600");

const project = new neon.Project("platform-db", {
  name: projectName,
  orgId: neonOrgId,
  pgVersion,
  regionId,
  historyRetentionSeconds,
  storePassword: "yes",
  branch: {
    name: projectBranchName,
    databaseName,
    roleName,
  },
});

export const neonProjectId = project.id;
export const neonProjectName = project.name;
export const neonDefaultBranchId = project.defaultBranchId;
export const neonDatabaseHost = project.databaseHost;
export const neonDatabaseHostPooler = project.databaseHostPooler;
export const neonDatabaseName = project.databaseName;
export const neonDatabaseUser = project.databaseUser;
export const databaseUrl = pulumi.secret(project.connectionUriPooler);
