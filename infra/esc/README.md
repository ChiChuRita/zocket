# Zocket ESC

The canonical dev configuration for Zocket lives in:

- `infra/esc/platform-dev.yaml`

Populate that file locally, then push it into Pulumi ESC:

```sh
pulumi env init <org>/zocket/platform-dev
pulumi env edit --file ./infra/esc/platform-dev.yaml <org>/zocket/platform-dev
```

Use that same environment for local platform commands:

```sh
pulumi env run <org>/zocket/platform-dev -- bun --cwd ./platform run dev
```

The `dev` stacks for these Pulumi projects already import `zocket/platform-dev`:

- `infra/pulumi-aws`
- `infra/pulumi-project-runtime`

AWS credentials stay outside this file. Use your normal AWS login/profile locally.
