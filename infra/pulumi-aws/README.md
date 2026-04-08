# Zocket AWS MVP

This Pulumi program scaffolds the MVP runtime topology described in `md/v1/aws.md`.

It is intentionally narrow:

- one VPC
- one public network load balancer for the gateway origin
- one gateway origin built from `packages/gateway/Dockerfile`
- one NATS host using the official image with JetStream enabled
- one ECS/Fargate runtime service built from `packages/runtime/Dockerfile`
- one ECS cluster for project-scoped runtimes

For dev, the stack imports the shared ESC environment from:

- `infra/esc/platform-dev.yaml`

Create and populate it once:

```sh
pulumi env init <org>/zocket/platform-dev
pulumi env edit --file ../esc/platform-dev.yaml <org>/zocket/platform-dev
```

The `dev` stack already imports `zocket/platform-dev` via `Pulumi.dev.yaml`, so `pulumi preview` and `pulumi up` will read:

- `aws:region`
- `zocket:domainName`
- `zocket:controlPlaneUrl`
- `zocket:controlPlaneInternalToken`
- `zocket:internalDomain`

Optional project runtime config still lives on the runtime stack, not in this base stack:

- `zocket:runtimeWorkspaceId`
- `zocket:runtimeProjectId`

Prerequisites:

- Docker must be running locally because Pulumi builds and pushes the project Dockerfiles to ECR
- AWS credentials must be allowed to manage ECR, ECS, ALB, ACM, Route 53, CloudWatch, IAM, and VPC resources
- AWS credentials should come from your normal local AWS login/profile, not from the ESC file
- public DNS stays in Cloudflare, not Route 53
- after `pulumi up`, point your Cloudflare wildcard record at the exported gateway load balancer hostname

This remains an MVP scaffold. It now treats AWS as the public origin behind Cloudflare instead of trying to own the public hosted zone itself.
