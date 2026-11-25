# Pinned exactly so builds are reproducible and scanners report what ships;
# bump deliberately.
FROM node:24.22.3-alpine3.24

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
# Runtime needs no devDependencies (test/lint/Lighthouse tooling).
RUN pnpm install --frozen-lockfile --prod

COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "--import", "remix/node-tsx", "server.ts"]
