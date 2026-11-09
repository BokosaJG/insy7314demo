# syntax=docker/dockerfile:1
# HustleHub+ client image: build the React app, then serve the static files
# with nginx (unprivileged, port 8080). nginx also proxies /api to the API
# container so the browser only ever talks to one origin (no CORS, no
# certificate warnings).

# ---- Stage 1: build --------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Stage 2: serve --------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1
