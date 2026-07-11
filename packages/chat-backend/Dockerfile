# Build context is the repo root (see docker-compose.yml `build.context: ..`).
# chat-backend has no internal workspace dependency (only `ws` + `zod`), so it
# builds standalone without the rest of the monorepo.

# ---- build stage: compile TypeScript -> dist ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY packages/chat-backend/package.json packages/chat-backend/tsconfig.json ./
RUN npm install
COPY packages/chat-backend/src ./src
RUN npm run build

# ---- runtime stage: prod deps + compiled output ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY packages/chat-backend/package.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
# FE-facing HTTP port (overridable via PORT env).
EXPOSE 8790
CMD ["node", "dist/index.js"]
