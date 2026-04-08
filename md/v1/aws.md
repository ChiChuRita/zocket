# AWS

This note defines the smallest sensible AWS setup for the Zocket MVP.

The goal is not a production-perfect architecture. The goal is a low-complexity platform that can run a few real tenants without introducing scaling systems too early.

This note is only about the runtime and ingress layer. The public docs site and the authenticated platform dashboard should be hosted on Cloudflare, with Convex still handling the platform backend and database.

The key v1 rule is:

- ARM only
- dedicated runtimes per tenant
- no scaling for gateways yet
- no scaling for NATS yet
- Pulumi manages the infrastructure as code

## V1 Shape

The simplest credible AWS shape is:

- Route 53 for `zocket.io`
- ACM wildcard certificate for `*.zocket.io`
- one Network Load Balancer in front of the gateway
- one small gateway instance
- one small NATS + JetStream instance
- one dedicated runtime service per tenant

The clean mental model is:

- one edge entrypoint
- one shared message bus
- one dedicated runtime per customer

Platform metadata does not need to live inside AWS in v1 because Convex handles the platform backend and database.

## Infrastructure As Code

Use Pulumi for the AWS infrastructure.

Pulumi should manage:

- NLB
- gateway instance
- NATS instance
- VPC and networking
- ECS services for tenant runtimes
- IAM and security-group wiring

The point is not sophisticated platform automation yet. The point is to keep the MVP infrastructure reproducible and easy to change without hand-editing AWS resources.

## Load Balancer Choice

V1 should use an NLB, not an ALB.

The reason is simple:

- lower overhead
- simpler L4 pass-through model
- good fit for long-lived WebSocket traffic
- less platform logic in the load balancer

The gateway still reads the `Host` header and resolves the tenant. We do not need L7 routing features in the balancer for the MVP.

This is a design preference, not a claim that ALB is unusable. ALB would also work. NLB is just the cleaner MVP choice if the main priority is minimal latency and minimal moving parts.

## Gateway

Start with one small Bun gateway instance.

Recommended v1 shape:

- one EC2 instance
- no autoscaling
- registered behind the NLB

Suggested instance:

- `t4g.medium`

Why:

- cheap enough for an MVP
- enough memory headroom for a modest number of WebSocket connections
- aligns with an ARM-only infrastructure choice

If the gateway becomes the first bottleneck, that is a good problem. It means the MVP has real usage.

## NATS

Start with one small dedicated NATS + JetStream instance.

Recommended v1 shape:

- one EC2 instance
- local disk or attached EBS for JetStream storage
- no clustering
- no failover automation

Suggested instance:

- `t4g.small`

Why:

- cheap
- enough for low-volume MVP messaging
- operationally simple

NATS does not need to scale in v1. If a single small box becomes the problem, the product has already validated something important.

## Dedicated Runtimes

Each tenant should get its own dedicated runtime unit.

For v1, the cleanest setup is:

- one ECS service per tenant
- desired count `1`
- one task per tenant by default
- no autoscaling

Suggested default runtime size:

- `0.5 vCPU`
- `1 GB` memory

Why this is a good MVP choice:

- dedicated execution per tenant
- easy to start and stop per deployment
- better isolation than shared processes
- simpler than managing your own process scheduler on EC2

If a tenant outgrows the default size, change that tenant's runtime configuration in Pulumi and redeploy. That is fine for v1.

## Metadata And Storage

Use the smallest boring primitives.

Recommended shape:

- Convex for tenants, projects, deployments, domains, and runtime metadata
- Convex file storage for deployment bundles and other platform-managed files

This keeps the AWS footprint smaller because the MVP does not need a separate Postgres control plane or a separate object-storage layer for the platform.

## Networking

Keep the network simple.

Recommended shape:

- one VPC
- public subnets for the NLB
- private subnets for gateway, NATS, and runtimes
- security groups that only allow the needed paths

Important paths:

- NLB -> gateway
- gateway -> NATS
- gateway -> platform API only if needed
- runtimes -> NATS
- runtimes -> Convex file endpoints only if they need to fetch bundle content indirectly
- platform app -> AWS resources where deployment orchestration is required

Do not over-design the network in v1.

## Deployment Flow

The AWS-side deployment flow should be:

1. user uploads or CLI pushes a bundle
2. bundle is stored in Convex file storage
3. deployment metadata is written to Convex
4. the tenant runtime service is updated or restarted
5. the runtime loads the new bundle
6. traffic keeps entering through the same shared gateway and shared NATS

The per-tenant runtime service is the main unit of deployment.

## Observability

Keep observability minimal but useful.

Need at least:

- structured logs for gateway and runtimes
- tenant-aware log fields
- NATS health checks
- runtime startup and deployment events
- basic process metrics

CloudWatch is enough for v1.

## What Not To Add Yet

Do not add these in the MVP unless forced by usage:

- gateway autoscaling
- NATS clustering
- runtime autoscaling
- multi-region anything
- custom domain automation
- service mesh
- Kubernetes

All of that adds operational drag before it adds product value.

## Short Version

The MVP AWS setup should be:

- Route 53 + ACM + one NLB
- one `t4g.medium` gateway instance
- one `t4g.small` NATS instance
- one ECS runtime service per tenant with a single small task

That is enough to ship an MVP with dedicated tenant execution and very little infrastructure complexity.
