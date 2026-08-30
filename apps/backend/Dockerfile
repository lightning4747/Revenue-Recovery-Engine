FROM node:22-alpine AS runner

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY node_modules ./node_modules
COPY apps/backend ./apps/backend

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "apps/backend/dist/src/main"]
