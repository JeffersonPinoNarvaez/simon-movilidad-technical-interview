#!/usr/bin/env bash
# Re-aplica telemetría y alertas de muestra (PDF) tras reset-demo --soft.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Aplicando seed de telemetría y alertas de muestra..."
docker compose exec -T timescaledb psql -U fleet -d fleetportal \
  < infra/docker/seed-sample-telemetry.sql

echo "Listo: DEF-456 (speeding+fuel), GHI-789 (critical_zone), ABC-123 offline para móvil."
