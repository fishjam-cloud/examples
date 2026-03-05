FROM node:24-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++
RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
COPY backend ./backend
COPY web ./web

RUN yarn install --immutable

RUN yarn workspace gemini-demo-backend build

FROM node:24-alpine AS runner

WORKDIR /app

RUN apk add --no-cache dumb-init python3 make g++
RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
COPY backend ./backend
COPY web ./web

RUN yarn install --immutable

COPY --from=builder /app/backend/dist ./backend/dist

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 8000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "backend/dist/main.js"]
