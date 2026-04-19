#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "Missing .env file at project root"
  exit 1
fi

echo "[deploy] pulling latest image and dependencies"
docker compose -f docker-compose.prod.yml --env-file .env pull app caddy mysql

echo "[deploy] starting updated services"
docker compose -f docker-compose.prod.yml --env-file .env up -d --remove-orphans

echo "[deploy] running migrations"
docker compose -f docker-compose.prod.yml --env-file .env exec -T app npm run migrate

echo "[deploy] running health check"
for i in {1..30}; do
  if curl -fsS "${APP_BASE_URL:-http://localhost}/health" >/dev/null; then
    echo "[deploy] healthy"
    exit 0
  fi
  sleep 2
done

echo "[deploy] health check failed"
exit 1
