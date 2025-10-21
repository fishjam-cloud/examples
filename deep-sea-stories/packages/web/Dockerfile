FROM node:24-alpine AS builder

WORKDIR /app

RUN npm install -g yarn@4.9.2

COPY package.json yarn.lock .yarnrc.yml ./
COPY packages/web ./packages/web
COPY packages/common ./packages/common

RUN yarn install --frozen-lockfile

ARG VITE_FISHJAM_ID
ARG VITE_BACKEND_URL

ENV VITE_FISHJAM_ID=$VITE_FISHJAM_ID
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

RUN cd packages/web && yarn run build

FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init

COPY --from=builder /app/packages/web/dist ./packages/web/dist

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]

CMD ["npx", "serve", "-s", "packages/web/dist", "-l", "3000"]
