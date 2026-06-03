# FleetPortal — Telemetry MVP

Portal corporativo de monitoreo de flotas con pipeline de telemetría de alta concurrencia, agente IA conversacional, app móvil offline-first y observabilidad completa.

## Entregables (prueba técnica)

| Entregable | Ubicación |
|------------|-----------|
| Repositorio Git (commits convencionales) | [github.com/JeffersonPinoNarvaez/simon-movilidad-technical-interview](https://github.com/JeffersonPinoNarvaez/simon-movilidad-technical-interview) |
| Documentación + IaC | Este README + `infra/terraform/` |
| Auditoría de IA | Sección [Auditoría de IA](#auditoría-de-ia) (2 casos) |
| Video de sustentación (5–10 min, YouTube no listado) | [youtu.be/8fzZKLWr3uQ](https://youtu.be/8fzZKLWr3uQ) |

## Arquitectura

```
Mobile/Device → POST /telemetry → Redis dedup → Kafka (telemetry.raw)
  → Consumer → Enrichment → TimescaleDB → Redis pub/sub → WebSocket → Dashboard
```

### Decisiones arquitectónicas

| Componente | Elección | Justificación |
|------------|----------|---------------|
| Bus de eventos | Redpanda (Kafka API) | Desacopla ingest HTTP del procesamiento; permite escalar consumidores (`telemetry-processors`) y replay ante picos (objetivo k6: 500 vehículos). |
| Series de tiempo | TimescaleDB | Hypertables por `time` + chunks horarios; índices `(device_id, time DESC)` para consultas de flota en alta frecuencia. Postgres evita operar Cassandra/Druid en local. |
| Cache / dedup | Redis | Ventana deslizante 5s (`dedup:{device_id}:{bucket}`) y pub/sub `vehicle:{id}:updates` hacia WebSocket sin bloquear el consumer. |
| Resiliencia | Opossum (circuit breakers) | Fronteras Kafka produce, TimescaleDB write y agente IA; estado expuesto en `GET /health/circuit-breakers`. |
| Agente IA | LangChain.js + OpenAI | Tools con filtros whitelist; temperatura 0 para respuestas reproducibles en demo. |

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

### Entorno agéntico

El desarrollo se orquestó con IDE agéntico (Cursor). Las reglas del proyecto están en [`.cursorrules`](./.cursorrules): stack no negociable, capas Clean Architecture, pipeline de telemetría, deduplicación Redis, circuit breakers y formato de auditoría IA. Ese archivo guió a la IA hacia DDD/SOLID y se usó para auditar/refactorizar sugerencias deficientes (ver [Auditoría de IA](#auditoría-de-ia)).

### Gestión de recursos locales

Si no levantas todo el stack a la vez (PDF §5):

- **Mínimo para API + dashboard:** `timescaledb`, `redis`, `redpanda`, `redpanda-init`, luego `api` y `web` (o `npm run dev` en apps).
- **Sin Docker en apps:** Infra en Compose; API/Web con `npm run dev` contra `localhost`.
- **Sin k6 local:** El job `k6-smoke` en GitHub Actions valida ingest bajo carga en CI.
- **Terraform:** Stubs opcionales; el MVP corre 100% con Docker Compose. No se requiere cuenta AWS para evaluar el código.

## Inicio rápido

### Prerrequisitos

- Docker & Docker Compose
- Node.js 20+
- (Opcional) k6 para pruebas de carga
- (Opcional) Terraform ≥ 1.5 solo si revisas IaC AWS

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

| Script | Uso | Comportamiento |
|--------|-----|----------------|
| `infra/k6/smoke.js` | CI / verificación rápida (~30s) | Ramp ligero, umbrales p95 y tasa de error |
| `infra/k6/fleet-chaos.js` | Caos completo (PDF §4E) | Ramp 50→200→500 vehículos; **~10%** peticiones duplicadas (mismo `event_id`); **~5%** payloads inválidos (422); **~85%** telemetría válida en bounding box Colombia |

```bash
k6 run -e API_URL=http://localhost:3001 infra/k6/smoke.js
k6 run -e API_URL=http://localhost:3001 infra/k6/fleet-chaos.js
```

### 6. Reset demo (video vs PDF con datos)

```bash
./scripts/reset-demo.sh --soft          # limpio para grabar móvil
./scripts/reset-demo.sh --soft --seed   # + telemetría/alertas de muestra PDF
./scripts/seed-sample-telemetry.sh      # solo re-aplica seed
```

## Infraestructura como código (Terraform)

Stubs AWS en `infra/terraform/main.tf`: VPC, subnets públicas, cluster ECS y RDS Postgres (placeholder para TimescaleDB en producción).

**Requisitos:** Terraform ≥ 1.5, credenciales AWS configuradas (`aws configure` o variables de entorno).

```bash
cd infra/terraform
terraform init
terraform plan \
  -var="aws_region=us-east-1" \
  -var="environment=staging" \
  -var="project_name=fleetportal"
# Solo si tienes cuenta AWS y quieres materializar stubs:
# terraform apply
```

**Outputs:** `vpc_id`, `ecs_cluster_arn`, `rds_endpoint`.

> En evaluación local basta Docker Compose. Terraform demuestra diseño cloud (Control Tower / multi-cuenta del PDF) sin ser obligatorio para levantar el MVP.

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
├── .cursorrules      # Reglas agénticas del proyecto
└── docker-compose.yml
```

## Endpoints API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/health/circuit-breakers` | Estado de circuit breakers por frontera de servicio |
| GET | `/metrics` | Métricas Prometheus |
| POST | `/telemetry` | Ingesta de telemetría (202 + pipeline Kafka) |
| GET | `/vehicles` | Lista de vehículos |
| GET | `/alerts` | Alertas activas |
| POST | `/agent/chat` | Chat con agente IA |

### Ejemplos de consultas al agente IA

Tras configurar `OPENAI_API_KEY` en `.env` y abrir el chat en `/dashboard`:

- «¿Qué vehículos llevan detenidos más de 20 minutos en zonas críticas?»
- «¿Cuántos vehículos están activos ahora?»
- «Muéstrame el historial de telemetría del vehículo ABC-123 en la última hora»
- «¿Hay alertas de exceso de velocidad o combustible bajo?»

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
| k6 en CI (10% dup / 5% error en chaos) | ✅ `fleet-chaos.js` + job `k6-smoke` en `.github/workflows/ci.yml` |
| Terraform + Docker Compose | ✅ `infra/terraform/` + `docker compose up -d` |

## Mobile + CI/CD

```bash
cd apps/mobile && npm start
```

- **DriverMapScreen**: mapa con tracking GPS y cola offline
- **SyncScreen**: estado de red, pendientes SQLite y sync manual por lotes
- **Fastlane** (`apps/mobile/fastlane/`): lanes `beta` para iOS/Android vía EAS Build
- **GitHub Actions** (`ci.yml`): tests + k6 smoke en cada push/PR; EAS en `main` solo si configuras el secret `EXPO_TOKEN` (si no, el job se omite sin fallar)

```bash
cd apps/mobile && bundle install && bundle exec fastlane ios beta
```

## Tests

```bash
npm test                              # domain, shared, api, web, mobile
npm run test:e2e --workspace=@fleet-portal/web   # Playwright dashboard (dev server)
```

## Sustentación virtual (guía para el video)

Contenido sugerido para el video de 5–10 min (YouTube no listado):

1. **Arquitectura (2–3 min):** diagrama del pipeline, TimescaleDB + Kafka + circuit breakers.
2. **Demo funcional (2–3 min):** dashboard en vivo, alerta por WebSocket, chat del agente, app móvil o `curl` de telemetría.
3. **Aceleración agéntica (2 min):** mostrar `.cursorrules`, un prompt que guió la IA y un caso de la [Auditoría de IA](#auditoría-de-ia).
4. **Caos opcional (1 min):** `k6 run … fleet-chaos.js` o mencionar el job en CI.

Video publicado: [https://youtu.be/8fzZKLWr3uQ](https://youtu.be/8fzZKLWr3uQ) (configurar visibilidad **No listado** en YouTube Studio si aún no lo está).

## Licencia

Proyecto de evaluación técnica — uso interno.
