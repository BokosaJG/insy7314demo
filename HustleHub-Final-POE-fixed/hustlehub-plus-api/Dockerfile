# syntax=docker/dockerfile:1
# HustleHub+ API image.
#  * Multi-stage: build tools and dev dependencies never reach the final image.
#  * Runs as the unprivileged "node" user, never root.
#  * Self-signed TLS certificate is generated on first start (docker-entrypoint.sh),
#    so no private key is ever baked into an image layer.

# ---- Stage 1: production dependencies only --------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- Stage 2: runtime ------------------------------------------------------
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=4000
WORKDIR /app

# openssl: used by the entrypoint to create the local TLS certificate.
# Not version-pinned on purpose: Alpine drops old package versions from its
# repositories, so a pin would break the build on the next base-image update.
# hadolint ignore=DL3018
RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .

# Writable locations for the non-root user (mounted as volumes by Compose).
RUN mkdir -p /app/logs /app/certs && chown -R node:node /app/logs /app/certs \
    && chmod +x /app/docker-entrypoint.sh

USER node
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "healthcheck.js"]

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "index.js"]
