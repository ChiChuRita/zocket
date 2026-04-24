# Deployment

This file records the current deployment model agreed in this repo.

## Environment Model

- We currently treat `prod` as the only real hosted environment.
- We do not maintain a separate hosted `staging` environment right now.
- Local development is separate from hosted environments.

In practice the shape is:

- `local` for development
- `prod` for the actual deployed system

## What Runs Where

### Cloudflare

Cloudflare is the always-on edge layer.

- `platform` is deployed on Cloudflare Workers.
- `docs` is deployed on Cloudflare Pages.
- Cloudflare also owns DNS for the main domain.

Current intended domain layout:

- `zocket.io` -> docs
- `www.zocket.io` -> redirect to `zocket.io`
- `platform.zocket.io` -> platform worker
- `*.zocket.io` -> hosted project/runtime traffic when AWS is enabled

## Neon

Neon is treated as always-on infrastructure.

- It is the production database/control-plane dependency.
- We do not plan to turn it on and off regularly.

## AWS

AWS is the expensive part, so it is intentionally optional.

- AWS-backed runtime infrastructure is allowed to be turned on and off.
- If AWS is off, hosted runtime traffic is expected to be unavailable.
- This is the current cost-control strategy.

Short-term operational model:

- keep Cloudflare + Neon on
- turn AWS on when hosted runtimes are needed
- turn AWS off when they are not worth paying for

## Commands

These are the main repo-level commands we want to use:

```bash
bun run platform:dev
bun run platform:deploy

bun run docs:dev
bun run docs:deploy

bun run neon:up

bun run aws:on
bun run aws:off

bun run cloudflare:sync
```

What they mean:

- `platform:dev` runs local platform development
- `platform:deploy` deploys the platform to Cloudflare
- `docs:dev` runs the docs locally
- `docs:deploy` builds and deploys docs to Cloudflare Pages
- `neon:up` applies Neon infrastructure
- `aws:on` applies the AWS Pulumi stack
- `aws:off` destroys the AWS Pulumi stack
- `cloudflare:sync` applies the Cloudflare Pulumi stack

## Local Workflow

Use local development instead of pretending there is a hosted `dev` stage.

- Platform local development uses the platform dev script.
- Docs local development uses Astro locally.
- Wrangler is primarily the deployment/runtime target for Cloudflare, not the main local mental model.

## Current Caveat

The platform deployment layer is not fully end-to-end for per-project hosted runtimes yet.

At the time of writing:

- `platform/src/server/deploy.ts` still throws
- `ensureProjectRuntime(...)` is not wired to actually create or update project runtimes automatically

That means the deployment model above is correct, but hosted runtime orchestration is still incomplete in the app layer.

## Notes

- Cloudflare should remain the authoritative DNS provider for the domain.
- Neon, platform, and docs should be considered always-on.
- AWS should remain the manually switchable cost center until runtime orchestration and cheaper base/runtime separation are improved.
