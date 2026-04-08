import { relations, sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    workosUserId: text("workos_user_id"),
    email: text("email").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workosUserIdIdx: uniqueIndex("users_workos_user_id_idx").on(table.workosUserId),
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
  }),
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ownerUserId: text("owner_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("workspaces_slug_idx").on(table.slug),
    ownerIdx: index("workspaces_owner_user_id_idx").on(table.ownerUserId),
  }),
);

export const workspaceMemberships = pgTable(
  "workspace_memberships",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workspaceUserIdx: uniqueIndex("workspace_memberships_workspace_user_idx").on(
      table.workspaceId,
      table.userId,
    ),
    userIdx: index("workspace_memberships_user_id_idx").on(table.userId),
  }),
);

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    domain: text("domain").notNull(),
    activeDeploymentId: text("active_deployment_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("projects_slug_idx").on(table.slug),
    domainIdx: uniqueIndex("projects_domain_idx").on(table.domain),
    workspaceIdx: index("projects_workspace_id_idx").on(table.workspaceId),
  }),
);

export const deployTokens = pgTable(
  "deploy_tokens",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    projectIdx: index("deploy_tokens_project_id_idx").on(table.projectId),
    hashIdx: uniqueIndex("deploy_tokens_token_hash_idx").on(table.tokenHash),
  }),
);

export const deployments = pgTable(
  "deployments",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    version: text("version").notNull(),
    bundleKey: text("bundle_key").notNull(),
    status: text("status").notNull(),
    actorTypes: text("actor_types")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    runtimeMessage: text("runtime_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: index("deployments_project_id_idx").on(table.projectId),
  }),
);

export const projectAuthConfigs = pgTable(
  "project_auth_configs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    mode: text("mode").notNull(),
    jwtSecret: text("jwt_secret"),
    jwksUrl: text("jwks_url"),
    issuer: text("issuer"),
    audience: text("audience"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: uniqueIndex("project_auth_configs_project_id_idx").on(table.projectId),
  }),
);

export const runtimeConfigs = pgTable(
  "runtime_configs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    runtimeApiUrl: text("runtime_api_url"),
    gatewayBaseUrl: text("gateway_base_url"),
    desiredStatus: text("desired_status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: uniqueIndex("runtime_configs_project_id_idx").on(table.projectId),
    workspaceIdx: index("runtime_configs_workspace_id_idx").on(table.workspaceId),
  }),
);

export const deviceFlows = pgTable(
  "device_flows",
  {
    id: text("id").primaryKey(),
    deviceCode: text("device_code").notNull(),
    userCode: text("user_code").notNull(),
    verificationUri: text("verification_uri").notNull(),
    status: text("status").notNull(),
    approvedUserId: text("approved_user_id"),
    issuedCliTokenHash: text("issued_cli_token_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    deviceCodeIdx: uniqueIndex("device_flows_device_code_idx").on(table.deviceCode),
    userCodeIdx: uniqueIndex("device_flows_user_code_idx").on(table.userCode),
  }),
);

export const cliTokens = pgTable(
  "cli_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("cli_tokens_token_hash_idx").on(table.tokenHash),
    userIdx: index("cli_tokens_user_id_idx").on(table.userId),
    workspaceIdx: index("cli_tokens_workspace_id_idx").on(table.workspaceId),
  }),
);

export const userRelations = relations(users, ({ many }) => ({
  memberships: many(workspaceMemberships),
}));

export const workspaceRelations = relations(workspaces, ({ many }) => ({
  memberships: many(workspaceMemberships),
  projects: many(projects),
}));

export const workspaceMembershipRelations = relations(workspaceMemberships, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMemberships.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [workspaceMemberships.userId],
    references: [users.id],
  }),
}));

export const projectRelations = relations(projects, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
}));
