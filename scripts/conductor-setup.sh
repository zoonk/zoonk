#!/bin/bash

# Copy .env files from root project to workspace
# Silently skip files that don't exist

copy_env() {
  local src="$CONDUCTOR_ROOT_PATH/$1"
  local dest="$1"
  [ -f "$src" ] && cp "$src" "$dest"
}

APPS=(admin auth editor evals main)
PACKAGES=(db)

# Root
copy_env ".env"
copy_env ".env.local"

# Apps
for app in "${APPS[@]}"; do
  copy_env "apps/$app/.env"
  copy_env "apps/$app/.env.local"
done

# Packages
for pkg in "${PACKAGES[@]}"; do
  copy_env "packages/$pkg/.env"
  copy_env "packages/$pkg/.env.local"
done

# Install dependencies
pnpm install
