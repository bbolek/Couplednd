# Family Quest game server — serves the player SPA, hosts the games, and
# holds the Anthropic API key (via env; never baked into the image).

# --- build: install workspace, build player SPA + server bundle ------------
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable

# Manifests first so dependency install caches across source-only changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server-core/package.json packages/server-core/
COPY packages/engine/package.json packages/engine/
COPY apps/player/package.json apps/player/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile --filter @familyquest/server... --filter @familyquest/player...

COPY packages ./packages
COPY apps/player ./apps/player
COPY apps/server ./apps/server
RUN pnpm --filter @familyquest/player build && pnpm --filter @familyquest/server build

# --- runtime: one bundled file + static assets ------------------------------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8787 \
    FQ_PLAYER_DIST=/app/public
COPY --from=build /repo/apps/server/dist/server.js ./server.js
COPY --from=build /repo/apps/player/dist ./public
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:8787/health >/dev/null || exit 1
CMD ["node", "server.js"]
