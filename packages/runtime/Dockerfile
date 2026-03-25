FROM oven/bun:1-alpine

WORKDIR /app

# Copy package.json files for dependency resolution
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
COPY packages/nats-transport/package.json packages/nats-transport/
COPY packages/runtime/package.json packages/runtime/

# Minimal root package.json with only the workspaces we need
RUN echo '{"workspaces":["packages/*"]}' > package.json

# Install deps
RUN bun install --no-save

# Copy source
COPY packages/core/ packages/core/
COPY packages/server/ packages/server/
COPY packages/nats-transport/ packages/nats-transport/
COPY packages/runtime/ packages/runtime/

EXPOSE 8080
CMD ["bun", "run", "packages/runtime/src/index.ts"]
