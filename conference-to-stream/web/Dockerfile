FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
ARG FISHJAM_ID
ARG VITE_BACKEND_URL=http://localhost:8080
ENV FISHJAM_ID=$FISHJAM_ID
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
