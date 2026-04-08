# Zocket Cloudflare

This Pulumi program manages Cloudflare resources separately from AWS and Neon.

The current stack manages:

- the `zocket.io` zone when it does not already exist in Cloudflare
- the tenant wildcard DNS record that points at the AWS gateway origin

The `dev` stack imports the shared ESC environment from:

- `infra/esc/platform-dev.yaml`

Required config:

- `zocket:cloudflareAccountId`

Typical flow:

```sh
bun install
pulumi stack init dev
pulumi preview
pulumi up
```

If the zone is created by Pulumi, the stack outputs the assigned Cloudflare name servers.
