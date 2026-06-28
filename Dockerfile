FROM flyio/litefs:0.5 AS litefs

FROM node:24-alpine

RUN apk add --no-cache fuse3

COPY --from=litefs /usr/local/bin/litefs /usr/local/bin/litefs

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm exec prisma generate

COPY litefs.yml /etc/litefs.yml

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["litefs", "mount"]
