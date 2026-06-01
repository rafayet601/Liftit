# ──────────────────────────────────────────────────────────
# Stage 1 — Build the React (Vite) frontend
# ──────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Install frontend deps (legacy-peer-deps needed for vite v8 + plugin-react)
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copy source and build static assets
COPY index.html vite.config.js postcss.config.js tailwind.config.js ./
COPY public/ public/
COPY src/ src/
RUN npm run build

# ──────────────────────────────────────────────────────────
# Stage 2 — Build the Express + Prisma backend
# ──────────────────────────────────────────────────────────
FROM node:20-alpine AS backend-builder
RUN apk add --no-cache openssl
WORKDIR /app/server

# Install backend deps
COPY server/package.json server/package-lock.json ./
RUN npm ci

# Copy Prisma schema first so `generate` can run before TS compile
COPY server/prisma/ prisma/
RUN npx prisma generate

# Copy backend source and compile TypeScript
COPY server/tsconfig.json ./
COPY server/src/ src/
RUN npm run build

# ──────────────────────────────────────────────────────────
# Stage 3 — Production image (nginx + node)
# ──────────────────────────────────────────────────────────
FROM node:20-alpine AS production
RUN apk add --no-cache nginx openssl

WORKDIR /app

# ── Nginx: serve static frontend + reverse-proxy /api → backend ──
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copy built frontend into nginx webroot
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Copy compiled backend + production deps + prisma artifacts
COPY --from=backend-builder /app/server/dist ./server/dist
COPY --from=backend-builder /app/server/node_modules ./server/node_modules
COPY --from=backend-builder /app/server/package.json ./server/
COPY --from=backend-builder /app/server/prisma ./server/prisma

# Copy the entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3001

# nginx on 80, backend on 3001
EXPOSE 80 3001

ENTRYPOINT ["/docker-entrypoint.sh"]
