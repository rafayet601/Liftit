FROM node:20-alpine AS base

# Frontend stage
FROM base AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Backend stage
FROM base AS backend-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npx prisma generate
RUN npm run build

# Production stage
FROM base AS production
WORKDIR /app

# Install dependencies for frontend serving
RUN npm install -g serve

# Copy built frontend
COPY --from=frontend-builder /app/dist ./dist

# Copy backend
COPY --from=backend-builder /app/server/dist ./server/dist
COPY --from=backend-builder /app/server/node_modules ./server/node_modules
COPY --from=backend-builder /app/server/package*.json ./server/
COPY --from=backend-builder /app/server/prisma ./server/prisma

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["sh", "-c", "cd server && npx prisma migrate deploy && node dist/index.js"]
