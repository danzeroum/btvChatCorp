# Estágio 1: Build Angular
FROM node:20-alpine AS builder

WORKDIR /app

ARG API_URL=/api
ENV API_URL=$API_URL

COPY package*.json .
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build -- --configuration production

# Estágio 2: Nginx serve
FROM nginx:1.25-alpine

COPY --from=builder /app/dist/btv-chat-corp/browser /usr/share/nginx/html

# Config nginx interna (SPA fallback)
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { try_files $uri $uri/ /index.html; } \
    gzip on; gzip_types text/plain application/json application/javascript text/css; \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
