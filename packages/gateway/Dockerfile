FROM oven/bun:1-alpine

WORKDIR /app

# Copy package.json files for dependency resolution
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
COPY packages/nats-transport/package.json packages/nats-transport/
COPY packages/gateway/package.json packages/gateway/

# Minimal root package.json with only the workspaces we need
RUN echo '{"workspaces":["packages/*"]}' > package.json

# Install production deps
RUN bun install --no-save

# Copy source (only what gateway needs)
COPY packages/core/ packages/core/
COPY packages/server/ packages/server/
COPY packages/nats-transport/ packages/nats-transport/
COPY packages/gateway/ packages/gateway/

EXPOSE 3000
CMD ["bun", "run", "packages/gateway/src/index.ts"]
