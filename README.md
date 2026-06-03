# FleetPortal — Telemetry MVP

Portal corporativo de monitoreo de flotas con pipeline de telemetría de alta concurrencia, agente IA conversacional, app móvil offline-first y observabilidad completa.

## Arquitectura

```
Mobile/Device → POST /telemetry → Redis dedup → Kafka (telemetry.raw)
  → Consumer → Enrichment → TimescaleDB → Redis pub/sub → WebSocket → Dashboard
```

### Stack

| Capa | Tecnología |
|------|------------|
| Backend | Node.js 20, Fastify, TypeScript, Clean Architecture |
| Broker | Redpanda (Kafka-compatible) |
| DB | TimescaleDB + Redis |
| Frontend | Next.js 14, Tailwind, react-leaflet, socket.io |
| Mobile | React Native + Expo (offline-first; cola tipo WatermelonDB vía expo-sqlite) |
| AI | LangChain.js + OpenAI |
| Chaos | k6 |
| IaC | Terraform (stubs AWS) |

## Inicio rápido

### Prerrequisitos

- Docker & Docker Compose
- Node.js 20+
- (Opcional) k6 para pruebas de carga

### 1. Configurar entorno

```bash
cp .env.example .env
# Editar OPENAI_API_KEY si deseas usar el agente IA
```

### 2. Levantar infraestructura y servicios

```bash
docker compose up -d
```

Servicios disponibles:

| Servicio | URL |
|----------|-----|
| Dashboard Web | http://localhost:3000 |
| API | http://localhost:3001 |
| Redpanda Console | http://localhost:8080 |
| TimescaleDB | localhost:5432 |
| Redis | localhost:6379 |

### 3. Desarrollo local (sin Docker para apps)

```bash
npm install
docker compose up -d timescaledb redis redpanda redpanda-init redpanda-console
npm run dev --workspace=@fleet-portal/api
npm run dev --workspace=@fleet-portal/web
```

### 4. Enviar telemetría de prueba

```bash
curl -X POST http://localhost:3001/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "b0000000-0000-4000-8000-000000000001",
    "device_id": "c0000000-0000-4000-8000-000000000001",
    "vehicle_id": "a0000000-0000-4000-8000-000000000001",
    "timestamp": "2025-05-29T12:00:00Z",
    "lat": 4.6097,
    "lng": -74.0817,
    "speed_kmh": 45
  }'
```

### 5. Prueba de carga (k6)

```bash
k6 run -e API_URL=http://localhost:3001 infra/k6/smoke.js      # smoke (~30s)
k6 run -e API_URL=http://localhost:3001 infra/k6/fleet-chaos.js # caos completo
```

### 6. Reset demo (video vs PDF con datos)

```bash
./scripts/reset-demo.sh --soft          # limpio para grabar móvil
./scripts/reset-demo.sh --soft --seed   # + telemetría/alertas de muestra PDF
./scripts/seed-sample-telemetry.sh      # solo re-aplica seed
```

## Estructura del monorepo

```
fleet-portal/
├── apps/
│   ├── api/          # Fastify backend (Clean Architecture)
│   ├── web/          # Next.js 14 dashboard
│   └── mobile/       # React Native + Expo
├── packages/
│   ├── domain/       # Entidades, Value Objects, interfaces
│   └── shared/       # DTOs, schemas Zod, constantes
├── infra/
│   ├── docker/       # Dockerfiles + init SQL
│   ├── terraform/    # IaC stubs AWS
│   └── k6/           # Scripts de carga
└── docker-compose.yml
```

## Endpoints API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/health/circuit-breakers` | Estado de circuit breakers por frontera de servicio |
| GET | `/metrics` | Métricas Prometheus |
| POST | `/telemetry` | Ingesta de telemetría |
| GET | `/vehicles` | Lista de vehículos |
| GET | `/alerts` | Alertas activas |
| POST | `/agent/chat` | Chat con agente IA |

## Auditoría de IA

Durante el desarrollo se rechazaron activamente las siguientes sugerencias del IDE agéntico:

### Caso 1: SQL directo en route handlers del agente IA

**Lo que sugirió la IA:** Implementar las herramientas LangChain (`query_vehicle_status`, `query_telemetry_history`) ejecutando queries SQL dinámicas directamente desde los controllers Fastify, pasando filtros del usuario sin capa intermedia.

**Por qué era deficiente:** Viola Clean Architecture al acoplar la capa de presentación con TimescaleDB. Expone riesgo de SQL injection si el agente genera filtros arbitrarios. Imposibilita testear la lógica de consulta sin levantar HTTP.

**Cómo lo corregí:** `AgentQueryService` en application con filtros whitelist (`in_critical_zone`, `plate:XXX`) y `createAgentTools()` con `DynamicStructuredTool` de LangChain. El agente invoca tools vía `bindTools` con loop de hasta 5 iteraciones.

**Principio aplicado:** Clean Architecture / SOLID (Dependency Inversion)

### Caso 2: Unificar ingest y process en un solo handler síncrono

**Lo que sugirió la IA:** Procesar telemetría de forma síncrona en `POST /telemetry` — validar, escribir en TimescaleDB, publicar WebSocket y responder 200 en la misma request, omitiendo Kafka.

**Por qué era deficiente:** Bajo carga de 500 vehículos (objetivo k6), acoplar ingest con persistencia bloquea el endpoint HTTP y degrada p95 latency. Sin cola, un pico de tráfico tumba TimescaleDB directamente. No permite replay ni escalado horizontal de procesadores.

**Cómo lo corregí:** Pipeline asíncrono: controller → dedup Redis → Kafka `telemetry.raw` → consumer group `telemetry-processors` → enrichment → DB → WebSocket. El endpoint responde 202 Accepted inmediatamente.

**Principio aplicado:** DDD / Resiliencia / Escalabilidad

## Dashboard web (UI moderna)

El portal incluye:

- **Skeletons y spinners** con animación shimmer mientras cargan mapa, vehículos y alertas
- **Toasts en tiempo real** al recibir `alert:new` por WebSocket (variantes success/warning/error)
- **Feed de alertas** con iconografía, gradientes y severidad visual
- **Agente IA** con sugerencias rápidas e indicador de escritura
- **Banner de reconexión** con backoff exponencial cuando cae el socket

Abrir http://localhost:3000/dashboard tras levantar la API. El dashboard usa **proxy Next.js** (`/api/*` → API Fastify); WebSocket sigue en `:3001`.

### Cumplimiento PDF (checklist)

| Requisito | Estado |
|-----------|--------|
| Tabla `devices` + FK telemetría | ✅ `init-db.sql` + validación en ingest |
| Seed telemetría/alertas | ✅ `02-seed-sample.sql` al crear DB; `./scripts/reset-demo.sh --soft --seed` |
| Alertas speeding / fuel | ✅ `ProcessTelemetryUseCase` + tests |
| WebSocket `vehicle:offline` | ✅ Scheduler + chequeo throttled en consumer Kafka |
| Proxy Next `/api` | ✅ `apps/web/src/app/api/[...path]/route.ts` |
| Cola offline (WatermelonDB) | ✅ Puerto `IOfflineQueueRepository` + adapter SQLite |
| Tests web / mobile | ✅ Vitest + Playwright (`apps/web`, `apps/mobile`) |
| k6 en CI | ✅ Job `k6-smoke` en `.github/workflows/ci.yml` |

## Mobile + CI/CD

```bash
cd apps/mobile && npm start
```

- **DriverMapScreen**: mapa con tracking GPS y cola offline
- **SyncScreen**: estado de red, pendientes SQLite y sync manual por lotes
- **Fastlane** (`apps/mobile/fastlane/`): lanes `beta` para iOS/Android vía EAS Build
- **GitHub Actions** (`ci.yml`): tests + k6 smoke + EAS en `main` (secret `EXPO_TOKEN`)

```bash
cd apps/mobile && bundle install && bundle exec fastlane ios beta
```

## Tests

```bash
npm test                              # domain, shared, api, web, mobile
npm run test:e2e --workspace=@fleet-portal/web   # Playwright dashboard (dev server)
```

## Licencia

Proyecto de evaluación técnica — uso interno.
