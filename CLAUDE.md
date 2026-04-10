# CLAUDE.md

Guidance for Claude Code when working with this repository.

## What this project is

Angular 21 SSR + Spring Boot demo platform for a Redis webinar. Six features, each showing the same use case implemented **without Redis** (left panel) vs **with Redis** (right panel). The goal is educational and honest — no artificial degradation of the non-Redis side.

Full context lives in `CONTEXT.md`. Read it before any non-trivial work.

---

## Commands

```bash
# Frontend (from repo root)
npm run dev              # Dev server → http://localhost:3000
npm run start:mocked     # Dev server with mocked data (no Docker needed)
npm run build            # Production build
npm test                 # Unit tests (Vitest)
npm run lint             # ESLint
npm run serve:ssr:app    # Serve production SSR build → http://localhost:4000

# Run a single test file
npx vitest run src/path/to/file.spec.ts

# Backends (from backend/)
docker compose up -d                        # Start all services
docker compose up --build <service> -d      # Rebuild + restart one service
docker compose ps                           # Check container status
docker compose logs -f <service>            # Tail logs
docker compose down                         # Stop all
docker compose down -v                      # Stop + wipe volumes
```

---

## Architecture

### Frontend — Angular 21

- **Standalone components only** — no NgModules
- **State** — Angular Signals
- **HTTP polling** — RxJS `interval + switchMap`, cleaned in `ngOnDestroy`
- **SSR** — Express 5 via `@angular/ssr/node` (`src/server.ts`). Does NOT proxy API calls; browser calls backends directly.
- **Styling** — Tailwind CSS v4 + CSS custom properties (design system in `CONTEXT.md` §4)
- **Fonts** — Poppins (titles), DM Sans (body)

Feature structure (same pattern for all 6):
```
src/app/features/<feature>/
  <feature>.service.ts    # HttpClient calls to backends
  <feature>.component.ts  # Standalone component
```

Core shared code:
```
src/app/core/
  components/request-panel/   # HTTP inspector panel (logs live requests)
  components/sidebar/         # Navigation sidebar
  interceptors/request-logger.interceptor.ts  # Captures all HttpClient calls
  services/request-logger.service.ts          # Stores captured requests
```

### Backend — Spring Boot (Java 21)

Each demo has one or two Spring Boot apps. All use `spring-boot-starter-data-redis` with `StringRedisTemplate`. Port mapping is **docker-compose only** — never touch `server.port` in `application.yml`.

| Feature | No-Redis service | With-Redis service |
|---------|------------------|--------------------|
| Gateway | :8081 | :8082 |
| Rate Limiting | :8083 | :8084 |
| Streams | :8085/producer | :8085/consumer |
| Locks | :8086/no-lock | :8086/with-lock |
| Geo | :8087 | :8087 (Redis only) |
| TTL | :8088/no-ttl | :8088/with-ttl |

### Mocked Mode

`src/app/core/mocks/mock.interceptor.ts` intercepts `HttpClient` and returns static data from `src/app/core/mocks/features/*.mock.ts`. Enabled via `environment.mocked = true`. `angular.json` swaps environments via `fileReplacements` at build time.

### Environment Configuration

- `src/environments/environment.ts` — default (`mocked: false`)
- `src/environments/environment.mocked.ts` — mocked config
- Actual base URLs per feature are configured inside each `*.service.ts` (not in environment.ts)

---

## Key implementation details

### Gateway (with Redis)
Routes stored as Redis hashes: `HSET route:/api/hello destination service-a active true maintenance false`. `RouteService` seeds 3 default routes on `ApplicationReadyEvent` only if Redis is empty — preserves data across restarts.

### Rate Limiting
- No-Redis: `ConcurrentHashMap<String, AtomicInteger>` — one counter per instance (A/B/C), no sharing
- With-Redis: `redis.opsForValue().increment("rate:global")` — single atomic counter across all instances

### Locks
- No-Redis: two `CompletableFuture` threads read-wait-write with no synchronization → race condition
- With-Redis: `setIfAbsent(LOCK_KEY, threadName, Duration.ofSeconds(10))` (SETNX) with spin-wait loop. Lock always released in `finally`. 10s TTL prevents deadlocks.

### TTL (2FA tokens)
- No-Redis: PostgreSQL table `token` with `created_at`. Manual batch cleanup (`deleteByCreatedAtBefore`).
- With-Redis: `SET 2fa:<email> "<code>:<initialTtl>" EX <ttl>`. Value encodes initial TTL to display progress bar. Redis auto-deletes expired keys.

### Streams
- Producer: `XADD events * <fields>` via `StreamOperations`
- Consumer: `XREADGROUP GROUP consumer-group myConsumer` with acknowledgement. Nginx proxy routes `/producer` and `/consumer` to the two Spring Boot apps both behind port 8085.

---

## Design system (non-negotiable)

```
--primary-color: #677ec7   /* blue  — "avec Redis" */
--accent-color:  #f05c4b   /* red   — "sans Redis", errors */
--bg-color:      #0f172a   /* global background */
--tile-bg:       #1e293b   /* card surface */
--text-light:    #ffffff
--text-muted:    #94a3b8
--border:        #334155
```

- Sans Redis column → always left, accent `#f05c4b`
- Avec Redis column → always right, accent `#677ec7`
- Status online: `#22c55e` / offline: `#f05c4b`

---

## Tests

Framework: **Vitest** + `@angular/core/testing` (`TestBed`).  
Only smoke tests exist (`expect(component).toBeTruthy()`). No HTTP mocking in tests — functional verification is done via the live mocked mode or Docker.

Do not add test complexity beyond what already exists unless explicitly asked.

---

## Rules for working in this repo

1. Read `CONTEXT.md` fully before any non-trivial feature work.
2. **Never modify `server.port` in `application.yml`** — port mapping is docker-compose only.
3. Modify only what was asked. No drive-by cleanups, no extra features, no new abstractions.
4. Respect the design system without exception — colors, typography, layout conventions are fixed.
5. Sans Redis column = left, Avec Redis = right. Always.
6. Health check polling runs every 500ms in all features — do not change polling frequency without explicit request.
7. `.env.local` must never be committed (contains `GEMINI_API_KEY`). `.gitignore` already excludes it.
8. Docker credentials (`demo/demo`) are intentionally trivial — this is a local demo environment only.
9. Backend build artifacts (`target/`) must never be committed.

---

## What this project is NOT

- Not a production application
- Not a biased benchmark — the no-Redis implementations are correct and honest
- Not fully tested — smoke tests only
- Not a Redis sales pitch — limits are acknowledged in the demo script (`DEMO.md`)
