CREATE TABLE "users" (
  "id" text PRIMARY KEY NOT NULL,
  "workos_user_id" text,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "users_workos_user_id_idx" ON "users" ("workos_user_id");
CREATE UNIQUE INDEX "users_email_idx" ON "users" ("email");

CREATE TABLE "workspaces" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "owner_user_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "workspaces_slug_idx" ON "workspaces" ("slug");
CREATE INDEX "workspaces_owner_user_id_idx" ON "workspaces" ("owner_user_id");

CREATE TABLE "workspace_memberships" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "user_id" text NOT NULL,
  "role" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "workspace_memberships_workspace_user_idx" ON "workspace_memberships" ("workspace_id", "user_id");
CREATE INDEX "workspace_memberships_user_id_idx" ON "workspace_memberships" ("user_id");

CREATE TABLE "projects" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "domain" text NOT NULL,
  "active_deployment_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "projects_slug_idx" ON "projects" ("slug");
CREATE UNIQUE INDEX "projects_domain_idx" ON "projects" ("domain");
CREATE INDEX "projects_workspace_id_idx" ON "projects" ("workspace_id");

CREATE TABLE "deploy_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "name" text NOT NULL,
  "token_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone
);

CREATE UNIQUE INDEX "deploy_tokens_token_hash_idx" ON "deploy_tokens" ("token_hash");
CREATE INDEX "deploy_tokens_project_id_idx" ON "deploy_tokens" ("project_id");

CREATE TABLE "deployments" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "version" text NOT NULL,
  "bundle_key" text NOT NULL,
  "status" text NOT NULL,
  "actor_types" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "runtime_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "deployments_project_id_idx" ON "deployments" ("project_id");

CREATE TABLE "project_auth_configs" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "mode" text NOT NULL,
  "jwt_secret" text,
  "jwks_url" text,
  "issuer" text,
  "audience" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "project_auth_configs_project_id_idx" ON "project_auth_configs" ("project_id");

CREATE TABLE "runtime_configs" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "workspace_id" text NOT NULL,
  "runtime_api_url" text,
  "gateway_base_url" text,
  "desired_status" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "runtime_configs_project_id_idx" ON "runtime_configs" ("project_id");
CREATE INDEX "runtime_configs_workspace_id_idx" ON "runtime_configs" ("workspace_id");

CREATE TABLE "device_flows" (
  "id" text PRIMARY KEY NOT NULL,
  "device_code" text NOT NULL,
  "user_code" text NOT NULL,
  "verification_uri" text NOT NULL,
  "status" text NOT NULL,
  "approved_user_id" text,
  "issued_cli_token_hash" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "device_flows_device_code_idx" ON "device_flows" ("device_code");
CREATE UNIQUE INDEX "device_flows_user_code_idx" ON "device_flows" ("user_code");

CREATE TABLE "cli_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "workspace_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone
);

CREATE UNIQUE INDEX "cli_tokens_token_hash_idx" ON "cli_tokens" ("token_hash");
CREATE INDEX "cli_tokens_user_id_idx" ON "cli_tokens" ("user_id");
CREATE INDEX "cli_tokens_workspace_id_idx" ON "cli_tokens" ("workspace_id");
