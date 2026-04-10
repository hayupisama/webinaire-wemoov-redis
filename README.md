# Plateforme de démo Redis — Webinaire Wemoov

Application Angular de démonstration visuelle comparant 6 cas d'usage Redis côte à côte (avec vs sans Redis), conçue pour un webinaire technique présenté par Fouad BARA (Wemoov / France Travail).

---

## Prérequis

- [Node.js](https://nodejs.org/) ≥ 20
- [Docker](https://www.docker.com/) + Docker Compose
- Une clé API [Google Gemini](https://aistudio.google.com/) (pour le chatbot intégré)

---

## Installation

```bash
# 1. Cloner le projet
git clone git@github.com:hayupisama/webinaire-wemoov-redis.git
cd webinaire-wemoov-redis

# 2. Installer les dépendances frontend
npm install

# 3. Configurer la clé Gemini
cp .env.example .env.local
# Éditer .env.local et renseigner GEMINI_API_KEY="votre_clé"
```

---

## Lancer la démo

### Mode complet (avec backends Docker)

```bash
# 1. Démarrer tous les backends + Redis + PostgreSQL
cd backend
docker compose up -d

# 2. Vérifier que tous les containers sont UP
docker compose ps

# 3. Lancer le frontend Angular (depuis la racine)
cd ..
npm run dev
# → http://localhost:3000
```

### Mode moqué (sans Docker, pour tester l'UI seule)

```bash
npm run start:mocked
# → http://localhost:3000
```

Attendre que toutes les pastilles soient **vertes** dans l'interface avant de commencer.

---

## Architecture générale

```
webinaire-wemoov-redis/
├── src/                        # Frontend Angular 21 (SSR via Express 5)
│   ├── server.ts               # Serveur Express SSR (ne proxy pas les API)
│   └── app/
│       ├── core/
│       │   ├── components/     # Composants partagés (sidebar, request-panel)
│       │   ├── interceptors/   # request-logger (capture requêtes HTTP)
│       │   └── services/       # request-logger.service (stocke les logs)
│       └── features/
│           ├── gateway/        # Démo 1 — Gateway dynamique
│           ├── rate-limiting/  # Démo 2 — Rate limiting multi-instances
│           ├── streams/        # Démo 3 — Redis Streams
│           ├── locks/          # Démo 4 — Locks distribués
│           ├── geo/            # Démo 5 — Géospatial
│           └── ttl/            # Démo 6 — Sessions & TTL
└── backend/                    # Services Spring Boot (Java 21)
    ├── gateway-no-redis/       # Routes hardcodées YAML  → :8081
    ├── gateway-redis/          # Routes dans Redis        → :8082
    ├── rate-limiting-no-redis/ # Compteur AtomicInt JVM   → :8083
    ├── rate-limiting-redis/    # Compteur INCR Redis      → :8084
    ├── streams-producer/       # Producteur stream        → :8085/producer
    ├── streams-consumer/       # Consommateur stream      → :8085/consumer
    ├── locks/                  # Débit avec/sans verrou   → :8086
    ├── geo/                    # Recherche géospatiale    → :8087
    ├── ttl/                    # Sessions avec/sans TTL   → :8088
    └── nginx/                  # Proxy streams (nginx)
```

**Principe de flux HTTP** : le frontend Angular appelle directement les backends depuis le navigateur. Le serveur Express SSR sert uniquement les assets et le rendu initial — il ne proxy aucun appel API.

Chaque feature appelle deux URLs :
- Service **sans Redis** (port pair : 8081, 8083…)
- Service **avec Redis** (port impair : 8082, 8084…)

---

## Environnement Docker Compose

Tous les services sont définis dans `backend/docker-compose.yml`.

| Container | Image / Build | Port local | Rôle |
|-----------|--------------|------------|------|
| `redis-demo` | `redis:7-alpine` | 6379 | Instance Redis partagée |
| `redis-demo-insight` | `redis/redisinsight` | 5540 | UI Redis (visualisation) |
| `redis-demo-postgres` | `postgres:16-alpine` | 5432 | PostgreSQL (démo TTL) |
| `redis-demo-pgadmin` | `dpage/pgadmin4` | 5050 | UI PostgreSQL |
| `redis-demo-gateway-no-redis` | Build local | 8081 | Gateway YAML |
| `redis-demo-gateway-redis` | Build local | 8082 | Gateway Redis |
| `redis-demo-ratelimit-no-redis` | Build local | 8083 | Rate limit JVM |
| `redis-demo-ratelimit-redis` | Build local | 8084 | Rate limit Redis |
| `redis-demo-streams-proxy` | `nginx:alpine` | 8085 | Proxy producer+consumer |
| `redis-demo-streams-producer` | Build local | — | Producteur stream |
| `redis-demo-consumer` | Build local | — | Consommateur stream |
| `redis-demo-locks` | Build local | 8086 | Locks avec/sans Redis |
| `redis-demo-geo` | Build local | 8087 | Géospatial Redis |
| `redis-demo-ttl` | Build local | 8088 | TTL Redis vs PostgreSQL |

Les services Spring Boot reçoivent `SPRING_DATA_REDIS_HOST: redis` pour se connecter au container Redis. Le service TTL reçoit aussi les variables PostgreSQL (`SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`).

**Redis est configuré avec `appendonly yes`** : la persistance AOF est activée, les données survivent au redémarrage du container.

---

## Explication du code par démo

### Démo 1 — Gateway Dynamique

**Sans Redis** (`gateway-no-redis`) : les routes sont dans `application.yml`. Un redémarrage vide la mémoire → requêtes perdues.

**Avec Redis** (`gateway-redis`) : `RouteService.java` stocke chaque route dans un hash Redis (`HSET route:/api/hello destination service-a active true ...`). Au démarrage (`@EventListener(ApplicationReadyEvent.class)`), le service vérifie si des routes existent déjà avant de seeder — ce qui permet la persistance entre redémarrages.

```java
// RouteService.java — écriture d'une route dans Redis
public void upsert(RouteDef route) {
    String key = "route:" + route.path();
    redis.opsForHash().put(key, "destination", route.destination());
    redis.opsForHash().put(key, "active",      String.valueOf(route.active()));
    // ...
}
```

La démo consiste à `docker stop` le service sans Redis pendant que les deux tirs tournent : les requêtes perdues s'accumulent à gauche, rien ne bouge à droite.

---

### Démo 2 — Rate Limiting Multi-Instances

**Sans Redis** (`rate-limiting-no-redis`) : trois instances `A`, `B`, `C` ont chacune un `AtomicInteger` en mémoire JVM. Chaque instance accepte jusqu'à 10 requêtes → le total global peut atteindre 30 avant qu'une seule instance déclenche un 429.

```java
// Sans Redis — compteur par instance (pas partagé)
private final Map<String, AtomicInteger> counters = new ConcurrentHashMap<>(Map.of(
    "A", new AtomicInteger(0),
    "B", new AtomicInteger(0),
    "C", new AtomicInteger(0)
));
```

**Avec Redis** (`rate-limiting-redis`) : un seul `INCR rate:global`. Redis étant monothreadé, l'incrémentation est atomique sans aucune synchronisation applicative.

```java
// Avec Redis — un seul compteur global atomique
public int hit() {
    Long count = redis.opsForValue().increment("rate:global");
    return (count != null && count <= QUOTA) ? 200 : 429;
}
```

---

### Démo 3 — Redis Streams

**Producer** (`streams-producer`) : publie des messages dans le stream `events` via `XADD`. Expose `/api/publish` et `/api/health`.

**Consumer** (`streams-consumer`) : lit le stream via un Consumer Group (`XREADGROUP`). Expose `/api/health`. Le proxy nginx réunit les deux sous le port 8085.

La démo consiste à `docker stop redis-demo-consumer` : les messages s'accumulent (`XPENDING`), le badge "En attente" monte. `docker start redis-demo-consumer` déclenche le rattrapage complet.

```bash
# Voir les messages en attente dans le groupe
docker exec -it redis-demo redis-cli XPENDING events consumer-group - + 10
```

---

### Démo 4 — Locks Distribués

**Sans verrou** (`NoLockService.java`) : deux threads `CompletableFuture` lisent le solde simultanément, attendent 200ms, puis écrivent. Le second thread écrase le premier → solde corrompu.

**Avec verrou** (`WithLockService.java`) : chaque thread tente un `SETNX` (via `setIfAbsent`) avec TTL de 10s. Le thread qui n'acquiert pas le lock tourne en spin-wait avec `Thread.sleep(50)`. Le verrou est libéré (`DEL lock:account:FR001`) dans un bloc `finally`.

```java
// Acquisition du lock distribué Redis
Boolean acquired = redis.opsForValue()
    .setIfAbsent(LOCK_KEY, "Thread-" + name, Duration.ofSeconds(10));
```

Le TTL de 10s garantit qu'un crash du thread libère le verrou automatiquement (anti-deadlock).

---

### Démo 5 — Géospatial

**Backend** (`geo`) : charge les villes françaises dans Redis via `GEOADD cities <longitude> <latitude> <nom>`. La recherche se fait avec `GEOSEARCH cities FROMMEMBER <ville> BYRADIUS <rayon> km ASC`.

```bash
# Voir les données dans Redis
docker exec -it redis-demo redis-cli ZCARD cities
docker exec -it redis-demo redis-cli GEOPOS cities Paris
```

---

### Démo 6 — Sessions & TTL (tokens 2FA)

**Sans TTL** (`NoTtlTokenService.java`) : les tokens sont stockés en PostgreSQL (table `token`, colonne `created_at`). Un batch manuel supprime les entrées de plus de 5 minutes. Sans ce batch, les tokens expirent logiquement mais restent en base.

**Avec TTL** (`WithTtlTokenService.java`) : chaque token est une clé Redis `2fa:<email>` avec une durée (`SET 2fa:user@mail.fr "123456:30" EX 30`). Redis supprime la clé automatiquement. La valeur encode aussi le TTL initial (`code:ttlInitial`) pour afficher la barre de progression dans l'UI.

```java
// Stockage avec TTL natif Redis
redis.opsForValue().set(key, code + ":" + ttlSeconds, Duration.ofSeconds(ttlSeconds));
```

---

## Mode moqué — fonctionnement interne

`src/app/core/interceptors/request-logger.interceptor.ts` intercepte toutes les requêtes `HttpClient`. En mode moqué (`environment.mocked = true`), `mock.interceptor.ts` retourne des données statiques issues de `src/app/core/mocks/features/*.mock.ts` sans appel réseau.

Les environnements sont sélectionnés via `fileReplacements` dans `angular.json` selon la configuration (`mocked`, `production`, `development`).

---

## Tests

### Philosophie

Pas de mocks de couche HTTP dans les tests : les tests unitaires Angular se limitent à la création des composants. Les vraies vérifications fonctionnelles se font via la démo live (mode moqué ou Docker).

### Lancer les tests

```bash
# Tous les tests
npm test

# Un seul fichier
npx vitest run src/app/app.spec.ts
```

### Stack de test

- **Framework** : [Vitest](https://vitest.dev/) avec `@angular/core/testing` (`TestBed`)
- **Pattern** : test de smoke (création du composant) — `expect(app).toBeTruthy()`
- Le fichier `src/app/app.spec.ts` vérifie que le composant racine se crée sans erreur

---

## Commandes utiles

```bash
# Frontend
npm run dev              # Dev server → http://localhost:3000
npm run start:mocked     # Dev server sans backend
npm run build            # Build production
npm run serve:ssr:app    # Servir le build SSR → http://localhost:4000
npm run lint             # ESLint

# Docker (depuis backend/)
docker compose up -d                        # Démarrer tous les services
docker compose ps                           # État des containers
docker compose logs -f <service>            # Logs en temps réel
docker compose restart <service>            # Redémarrer sans rebuild
docker compose up --build <service> -d      # Rebuilder + relancer
docker compose down                         # Tout éteindre
docker compose down -v                      # Éteindre + supprimer les volumes

# Redis CLI
docker exec -it redis-demo redis-cli        # Shell Redis interactif
docker exec -it redis-demo redis-cli FLUSHALL  # Vider Redis (attention)
docker exec -it redis-demo redis-cli KEYS "route:*"
docker exec -it redis-demo redis-cli GET rate:global
docker exec -it redis-demo redis-cli XLEN events
docker exec -it redis-demo redis-cli TTL 2fa:<email>
```

---

## Reset entre deux passages de démo

```bash
# Rate limiting
docker exec -it redis-demo redis-cli DEL rate:global

# Gateway (routes)
docker exec -it redis-demo redis-cli KEYS "route:*" | xargs docker exec -i redis-demo redis-cli DEL
curl -s -X POST http://localhost:8082/api/routes -H "Content-Type: application/json" \
  -d '{"path":"/api/hello","destination":"service-a","active":true,"maintenance":false}'
curl -s -X POST http://localhost:8082/api/routes -H "Content-Type: application/json" \
  -d '{"path":"/api/orders","destination":"service-b","active":true,"maintenance":false}'
curl -s -X POST http://localhost:8082/api/routes -H "Content-Type: application/json" \
  -d '{"path":"/api/users","destination":"service-c","active":true,"maintenance":false}'

# Streams
docker exec -it redis-demo redis-cli DEL events
docker start redis-demo-consumer

# Remettre la gateway sans Redis si elle a été stoppée
docker start redis-demo-gateway-no-redis
```

---

## URLs

| Service                  | URL                                       |
|--------------------------|-------------------------------------------|
| Frontend Angular         | http://localhost:3000                     |
| Gateway sans Redis       | http://localhost:8081/health              |
| Gateway avec Redis       | http://localhost:8082/health              |
| Rate Limiting sans Redis | http://localhost:8083/health              |
| Rate Limiting avec Redis | http://localhost:8084/health              |
| Streams Producer         | http://localhost:8085/producer/api/health |
| Streams Consumer         | http://localhost:8085/consumer/api/health |
| Locks                    | http://localhost:8086/health              |
| Geo                      | http://localhost:8087/health              |
| TTL                      | http://localhost:8088/health              |
| Redis Insight (UI Redis) | http://localhost:5540                     |
| pgAdmin (UI PostgreSQL)  | http://localhost:5050                     |

---

## Sécurité

Le fichier `.env.local` contenant la clé Gemini est exclu du dépôt via `.gitignore` (pattern `.env*`).  
Copier `.env.example` et y renseigner sa propre clé — ne jamais committer `.env.local`.

Les credentials Docker (`demo/demo/demo`) sont des valeurs de démo pour un environnement local uniquement.
