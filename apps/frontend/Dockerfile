# Stage 1: Build stage
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/frontend/package.json ./apps/frontend/
RUN pnpm install --frozen-lockfile

COPY apps/frontend/tsconfig.json apps/frontend/vite.config.ts apps/frontend/index.html ./apps/frontend/
COPY apps/frontend/src ./apps/frontend/src

RUN pnpm --filter frontend build

# Stage 2: Production NGINX server
FROM nginx:alpine AS runner

COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
