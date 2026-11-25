# Pinned exactly so builds are reproducible and scanners report what ships;
# bump deliberately (both stages).

# --- deps: pnpm only lives here --------------------------------------------
FROM node:24.22.3-alpine3.24 AS deps

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
# pnpm via npm, not corepack (no longer bundled from Node 25 on). The
# version comes from package.json's packageManager — one source of truth.
RUN npm install -g "$(node -p 'require("./package.json").packageManager')"
# Runtime needs no devDependencies (test/lint/Lighthouse tooling).
RUN pnpm install --frozen-lockfile --prod

# --- runtime: node + node_modules + app, no package managers ----------------
FROM node:24.22.3-alpine3.24

# Pull in Alpine security fixes published after the base image was built.
RUN apk upgrade --no-cache

# The server runs `node` directly; the base image's npm, npx, corepack and
# yarn are unused here and carried most of its reported vulnerabilities.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
	/usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
	/usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-*

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "--import", "remix/node-tsx", "server.ts"]
