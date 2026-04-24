# AWS

This note defines the current AWS setup for the Zocket MVP runtime layer.

The goal is not a production-perfect architecture. The goal is a low-complexity
runtime origin that can run a few real projects without introducing scaling
systems too early.

This note is only about the runtime and gateway layer. Public DNS, docs, and the
authenticated platform dashboard are owned by Cloudflare. Platform metadata lives
in Neon, and deployment bundles live in S3-compatible object storage.

The key v1 rule is:

- ARM only
- Cloudflare owns public DNS
- AWS is the optional runtime cost center
- shared gateway and NATS
- dedicated runtimes per project
- no scaling for gateways yet
- no scaling for NATS yet
- Pulumi manages the infrastructure as code

## V1 Shape

The current AWS shape is:

- one VPC
- public subnets for the Network Load Balancer
- private subnets for gateway, NATS, and runtime services
- one public Network Load Balancer as the gateway origin
- one Bun gateway EC2 instance built from `packages/gateway/Dockerfile`
- one NATS + JetStream EC2 instance
- one ECS/Fargate cluster for project runtimes
- one per-project ECS service managed by the project runtime stack
- ECR repositories for gateway and runtime images
- CloudWatch logs for runtime services

The clean mental model is:

- Cloudflare is the public edge and DNS authority
- AWS is the runtime origin behind Cloudflare
- NATS is the shared message bus
- each project runtime is the execution boundary

## Infrastructure As Code

Use Pulumi for AWS infrastructure.

The base AWS stack manages:

- VPC and networking
- public NLB
- gateway instance
- NATS instance and internal DNS
- ECR repositories and images
- ECS cluster for project-scoped runtimes
- IAM and security groups

The per-project runtime stack manages:

- Fargate task definition
- runtime ECS service
- runtime log group
- deployment-specific runtime environment

The point is not sophisticated platform automation yet. The point is to keep the
MVP infrastructure reproducible and easy to change without hand-editing AWS
resources.

## DNS And Edge

Do not put public DNS ownership in AWS for v1.

Current model:

- Cloudflare owns `zocket.io`
- `platform.zocket.io` routes to the Cloudflare Worker platform app
- `zocket.io` routes to docs
- `*.zocket.io` points at the AWS gateway load balancer when AWS is enabled

AWS exposes the gateway origin. Cloudflare remains the public authority.

## Load Balancer Choice

V1 uses an NLB, not an ALB.

The reason is simple:

- lower overhead
- simple L4 pass-through model
- good fit for long-lived WebSocket traffic
- less platform logic in the load balancer

The gateway still reads the `Host` header and resolves the project through the
control plane. We do not need L7 routing features in the balancer for the MVP.

## Gateway

Start with one small Bun gateway instance.

Current v1 shape:

- one EC2 instance
- no autoscaling
- registered behind the NLB
- Docker image built from `packages/gateway/Dockerfile`

Suggested instance:

- `t4g.medium`

Why:

- cheap enough for an MVP
- enough memory headroom for a modest number of WebSocket connections
- aligns with an ARM-only infrastructure choice

If the gateway becomes the first bottleneck, that is a good problem. It means the
MVP has real usage.

## NATS

Start with one small dedicated NATS + JetStream instance.

Current v1 shape:

- one EC2 instance
- attached EBS volume for JetStream data
- no clustering
- no failover automation
- private Route 53 zone for internal `nats.zocket.internal`

Suggested instance:

- `t4g.small`

Why:

- cheap
- enough for low-volume MVP messaging
- operationally simple

NATS does not need to scale in v1. If a single small box becomes the problem, the
product has already validated something important.

## Dedicated Runtimes

Each project should get its own dedicated runtime unit.

For v1, the cleanest setup is:

- one ECS/Fargate service per project
- desired count `1` when active
- desired count `0` when idle
- one task per project by default
- no autoscaling

Default runtime size:

- `0.5 vCPU`
- `1 GB` memory

Why this is a good MVP choice:

- dedicated execution per project
- easy to start and stop per deployment
- better isolation than shared processes
- simpler than managing a custom process scheduler on EC2

If a project outgrows the default size, change that project's runtime
configuration and redeploy.

## Metadata And Storage

Use boring primitives.

Current shape:

- Neon Postgres for users, workspaces, projects, auth config, runtime config, and deployments
- Drizzle for schema and migrations
- S3-compatible object storage for deployment bundles
- AWS runtime stacks receive project and deployment IDs through environment variables

The AWS runtime layer should not become the platform database.

## Networking

Keep the network simple.

Current shape:

- one VPC
- public subnets for the NLB
- private subnets for gateway, NATS, and runtimes
- NAT gateway for private egress
- security groups that only allow the needed paths

Important paths:

- NLB -> gateway
- gateway -> NATS
- gateway -> platform API
- runtimes -> NATS
- runtimes -> platform API
- platform app -> AWS resources where deployment orchestration is required
- runtimes -> S3-compatible bundle source indirectly through the platform API

Do not over-design the network in v1.

## Deployment Flow

The intended deployment flow is:

1. user runs `zocket deploy`
2. CLI bundles the actor entry with Bun
3. platform stores the bundle in S3-compatible storage
4. platform writes deployment metadata to Neon
5. platform updates or creates the project runtime service
6. runtime boots with `WORKSPACE_ID`, `PROJECT_ID`, and `DEPLOYMENT_ID`
7. runtime fetches the bundle from the platform API
8. runtime loads the app definition and starts NATS consumers
9. runtime reports ready or failed status to the platform
10. traffic keeps entering through the same shared gateway and NATS path

The current caveat is that step 5 is not wired in the platform app yet:
`platform/src/server/deploy.ts` still throws.

## Observability

Keep observability minimal but useful.

Need at least:

- structured logs for gateway and runtimes
- workspace, project, actor, session, and request IDs in logs
- NATS health checks
- runtime startup and deployment events
- basic process metrics
- deploy failure reasons in the platform

CloudWatch is enough for v1, but plain console logs are not enough for an
infrastructure product once external users arrive.

## What Not To Add Yet

Do not add these in the MVP unless forced by usage:

- gateway autoscaling
- NATS clustering
- runtime autoscaling
- multi-region anything
- custom domain automation
- service mesh
- Kubernetes
- Firecracker or microVM isolation

All of that adds operational drag before it adds product value.

## Short Version

The MVP AWS setup is:

- Cloudflare DNS in front of an AWS gateway origin
- one public NLB
- one `t4g.medium` gateway instance
- one `t4g.small` NATS instance
- one ECS/Fargate runtime service per project
- Neon for platform metadata
- S3-compatible storage for deployment bundles

That is enough to ship an MVP with dedicated project execution and limited
infrastructure complexity.
