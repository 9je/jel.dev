FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
ARG GIT_SHA=dev
LABEL org.opencontainers.image.source="https://github.com/9je/jel.dev"
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-headers.conf /etc/nginx/jel-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
RUN printf '%s\n' "$GIT_SHA" > /usr/share/nginx/html/build.txt
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
