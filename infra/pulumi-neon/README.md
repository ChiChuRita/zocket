# Zocket Neon

This Pulumi program provisions the control-plane Postgres database in Neon.

It is intentionally separate from:

- `infra/pulumi-aws` for disposable AWS runtime infrastructure
- `infra/pulumi-cloudflare` for public DNS and Cloudflare-managed edge resources

The `dev` stack imports the shared ESC environment from:

- `infra/esc/platform-dev.yaml`

Typical flow:

```sh
bun install
pulumi stack init dev
pulumi preview
pulumi up
```

Notes:

- the stack pins Neon history retention to `21600` seconds to match the current org limit
- `databaseUrl` is exported as a secret output for the platform app
