FROM node:24-alpine AS builder

WORKDIR /app

RUN npm install -g yarn@4.9.2

COPY package.json yarn.lock .yarnrc.yml ./
COPY packages/backend ./packages/backend
COPY packages/common ./packages/common

RUN yarn install --frozen-lockfile

RUN cd packages/backend && yarn run build

FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init

RUN npm install -g yarn@4.9.2

COPY package.json yarn.lock .yarnrc.yml ./
COPY packages/backend/package.json ./packages/backend/package.json
COPY packages/common/package.json ./packages/common/package.json

RUN yarn install --frozen-lockfile --production

COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/backend/src/prompts ./packages/backend/src/prompts

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 8000

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "packages/backend/dist/src/main.js"]
