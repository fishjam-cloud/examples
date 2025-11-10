FROM node:24-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
COPY packages ./packages

RUN yarn install --frozen-lockfile

RUN yarn workspace @deep-sea-stories/common build

ARG VITE_FISHJAM_ID
ARG VITE_BACKEND_URL

ENV VITE_FISHJAM_ID=$VITE_FISHJAM_ID
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

RUN ./node_modules/.bin/vite build packages/web

FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init

COPY --from=builder /app/packages/common/dist ./packages/common/dist
COPY --from=builder /app/packages/web/dist ./packages/web/dist

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]

CMD ["npx", "serve", "-s", "packages/web/dist", "-l", "3000"]
