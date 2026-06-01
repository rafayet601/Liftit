#!/bin/sh
set -e

echo "🚀 Liftit — starting up…"

# Run Prisma migrations / push schema to DB
echo "📦 Pushing Prisma schema to database…"
cd /app/server
npx prisma db push --skip-generate --accept-data-loss 2>&1 || {
  echo "⚠️  Prisma db push failed — retrying in 5s…"
  sleep 5
  npx prisma db push --skip-generate --accept-data-loss
}

# Start the Express backend in the background
echo "🔧 Starting backend on port ${PORT:-3001}…"
node dist/src/index.js &
BACKEND_PID=$!

# Wait for backend to be ready
echo "⏳ Waiting for backend health check…"
for i in $(seq 1 30); do
  if wget -q --spider http://127.0.0.1:${PORT:-3001}/health 2>/dev/null; then
    echo "✅ Backend is healthy"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "❌ Backend failed to start within 30s"
    exit 1
  fi
  sleep 1
done

# Start nginx in the foreground
echo "🌐 Starting nginx on port 80…"
exec nginx -g "daemon off;"
