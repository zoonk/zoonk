#!/bin/bash

# Run migrations conditionally based on environment:
# - Vercel production: run migrations
# - Vercel preview: skip migrations (multiple branches may deploy simultaneously)
# - Non-Vercel (staging, etc.): run migrations

if [ "$VERCEL_ENV" = "preview" ]; then
  echo "Skipping migrations for Vercel preview deployment"
  exit 0
fi

echo "Running database migrations..."
pnpm --filter @zoonk/db db:deploy
