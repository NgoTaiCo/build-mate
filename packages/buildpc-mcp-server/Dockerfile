# Build context is the repo root (see docker/docker-compose.yml `build.context: ..`).
# Unlike chat-backend, mcp-server depends on two workspace packages:
#   @buildmate/compiler (no runtime deps) and @buildmate/catalog (apify-client).
# So we install the workspace, build compiler -> catalog -> mcp-server, then
# ship the compiled dist of all three plus prod-only node_modules.

# ---- build stage: install workspace + compile TypeScript -> dist ----
FROM node:22-alpine AS builder
WORKDIR /app

# Manifests first for better layer caching.
COPY package.json package-lock.json ./
COPY packages/compiler/package.json packages/compiler/
COPY packages/catalog/package.json packages/catalog/
COPY packages/buildpc-mcp-server/package.json packages/buildpc-mcp-server/
RUN npm install

# Sources for the three packages this image needs.
COPY packages/compiler packages/compiler
COPY packages/catalog packages/catalog
COPY packages/buildpc-mcp-server packages/buildpc-mcp-server

# Build in dependency order (mcp-server imports the compiled dist of the others).
RUN npm run build -w @buildmate/compiler \
  && npm run build -w @buildmate/catalog \
  && npm run build -w @buildmate/buildpc-mcp-server \
  && npm prune --omit=dev

# ---- runtime stage: prod node_modules + compiled output only ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8791
ENV MCP_PATH=/mcp
# Catalog data source: phongvu (cached JSON, default) | mock | live (Apify).
ENV CATALOG_DATA_SOURCE=phongvu

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/compiler/package.json ./packages/compiler/package.json
COPY --from=builder /app/packages/compiler/dist ./packages/compiler/dist
COPY --from=builder /app/packages/catalog/package.json ./packages/catalog/package.json
COPY --from=builder /app/packages/catalog/dist ./packages/catalog/dist
# PhongVu catalog JSON — data-loader reads ../data relative to dist at runtime.
# Without this, search_components silently falls back to the tiny MOCK_CATALOG.
COPY --from=builder /app/packages/catalog/data ./packages/catalog/data
COPY --from=builder /app/packages/buildpc-mcp-server/package.json ./packages/buildpc-mcp-server/package.json
COPY --from=builder /app/packages/buildpc-mcp-server/dist ./packages/buildpc-mcp-server/dist

# Streamable HTTP transport port (overridable via PORT env).
EXPOSE 8791
WORKDIR /app/packages/buildpc-mcp-server
CMD ["node", "dist/http.js"]
