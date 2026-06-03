#!/usr/bin/env bash
# Reset FleetPortal para grabación del video: DB limpia + Redis + estado inicial.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="${1:---soft}"
SEED_SAMPLE=false
if [[ "${2:-}" == "--seed" ]] || [[ "$MODE" == "--seed" ]]; then
  SEED_SAMPLE=true
  [[ "$MODE" == "--seed" ]] && MODE="--soft"
fi

echo "==> FleetPortal demo reset ($MODE)"

if [[ "$MODE" == "--full" ]]; then
  echo "    Deteniendo stack y borrando volumen TimescaleDB..."
  docker compose down -v
  echo "    Levantando stack..."
  docker compose up -d
  echo "    Esperando API healthy (hasta ~90s)..."
  for i in $(seq 1 30); do
    if curl -sf http://localhost:3001/health >/dev/null 2>&1; then
      echo "    API lista."
      break
    fi
    sleep 3
  done
else
  echo "    Truncando telemetría, alertas y sesiones detenidas..."
  docker compose exec -T timescaledb psql -U fleet -d fleetportal \
    < infra/docker/reset-demo-data.sql
fi

if docker compose ps redis 2>/dev/null | grep -q running; then
  echo "    Limpiando claves Redis (dedup + contadores)..."
  docker compose exec -T redis redis-cli FLUSHDB >/dev/null
fi

if [[ "$SEED_SAMPLE" == "true" ]]; then
  echo "    Aplicando telemetría y alertas de muestra (PDF)..."
  docker compose exec -T timescaledb psql -U fleet -d fleetportal \
    < infra/docker/seed-sample-telemetry.sql
fi

echo ""
echo "Estado demo:"
echo "  - 3 vehículos: ABC-123, DEF-456, GHI-789"
echo "  - 3 zonas críticas: Bogotá Centro, Cartagena, Medellín"
if [[ "$SEED_SAMPLE" == "true" ]]; then
  echo "  - Muestra: DEF-456 speeding+fuel, GHI-789 critical_zone, ABC-123 offline (móvil)"
else
  echo "  - 0 eventos GPS, 0 alertas (ideal para video móvil)"
  echo "  - Opcional PDF: ./scripts/reset-demo.sh --soft --seed"
fi
echo ""
echo "URLs:"
echo "  Dashboard  http://localhost:3000/dashboard"
echo "  API        http://localhost:3001/health"
echo "  Redpanda   http://localhost:8080"
echo ""
echo "Mobile (iPhone): apps/mobile/.env → EXPO_PUBLIC_API_URL=http://TU_IP_LAN:3001"
echo "Listo para grabar."
