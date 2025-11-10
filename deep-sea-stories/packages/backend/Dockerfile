FROM node:24-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
COPY packages ./packages

RUN yarn install --frozen-lockfile

RUN yarn workspace @deep-sea-stories/common build

RUN yarn workspace backend build

FROM node:24-alpine AS runner

WORKDIR /app

RUN apk add --no-cache dumb-init python3 make g++

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
COPY packages ./packages

RUN yarn install --frozen-lockfile

COPY --from=builder /app/packages/common/dist ./packages/common/dist
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 8000

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "packages/backend/dist/src/main.js"]

