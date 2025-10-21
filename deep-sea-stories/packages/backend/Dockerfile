FROM node:24-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
COPY packages ./packages

RUN yarn install --frozen-lockfile

RUN ./node_modules/.bin/tsc -p packages/backend/tsconfig.json --noEmitOnError=false && mkdir -p packages/backend/dist/src/prompts && cp -R packages/backend/src/prompts/* packages/backend/dist/src/prompts/ || true

FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init

RUN corepack enable

FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
COPY packages ./packages

RUN yarn install --frozen-lockfile

COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/backend/src/prompts ./packages/backend/src/prompts

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 8000

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "packages/backend/dist/src/main.js"]
