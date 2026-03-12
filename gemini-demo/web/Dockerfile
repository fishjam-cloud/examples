FROM node:24-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++
RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
COPY backend ./backend
COPY web ./web

ARG VITE_FISHJAM_ID
ENV VITE_FISHJAM_ID=$VITE_FISHJAM_ID

RUN yarn install --immutable

RUN ./node_modules/.bin/vite build web

FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init

COPY --from=builder /app/web/dist ./web/dist

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["npx", "serve", "-s", "web/dist", "-l", "tcp://0.0.0.0:3000"]
