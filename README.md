# Plateforme de démo Redis — Webinaire Wemoov

Application Angular de démonstration visuelle comparant 6 cas d'usage Redis côte à côte (avec vs sans Redis), conçue pour un webinaire technique.

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

---

## Vérifier que tout est prêt

Attendre que toutes les pastilles soient **vertes** dans l'interface avant de commencer.

```bash
# Health checks de tous les services
curl -s -o /dev/null -w "gateway no-redis  : %{http_code}\n" http://localhost:8081/health
curl -s -o /dev/null -w "gateway redis      : %{http_code}\n" http://localhost:8082/health
curl -s -o /dev/null -w "rate-limit no-redis: %{http_code}\n" http://localhost:8083/health
curl -s -o /dev/null -w "rate-limit redis   : %{http_code}\n" http://localhost:8084/health
curl -s -o /dev/null -w "locks              : %{http_code}\n" http://localhost:8086/health
curl -s -o /dev/null -w "geo                : %{http_code}\n" http://localhost:8087/health
curl -s -o /dev/null -w "ttl                : %{http_code}\n" http://localhost:8088/health
# → tous doivent répondre 200
```

---

## Les 6 démos

### Démo 1 — Gateway Dynamique

**Problème** : routes hardcodées en YAML → rebuild + redémarrage → requêtes perdues.  
**Avec Redis** : routes stockées dans Redis, rechargées à chaud, zéro downtime.

```bash
# Simuler une panne de la gateway sans Redis
docker stop redis-demo-gateway-no-redis
# → compteur "Requêtes perdues" monte côté gauche

# La relancer
docker start redis-demo-gateway-no-redis

# Filtres Chrome DevTools (onglet Network)
# -url:/health -url:/api/routes
```

---

### Démo 2 — Rate Limiting Multi-Instances

**Problème** : chaque instance a son propre compteur → quota global jamais respecté.  
**Avec Redis** : un seul compteur atomique (`INCR`) partagé → 429 dès la 11e requête.

```bash
# 100% UI — aucune commande nécessaire

# Reset manuel du compteur Redis si besoin
docker exec -it redis-demo redis-cli DEL rate:global

# Filtres Chrome DevTools
# url:/api/rate/hit
```

---

### Démo 3 — Redis Streams

**Scénario** : couper le consommateur, laisser les messages s'accumuler, relancer → rattrapage complet.

```bash
# Couper le consommateur
docker stop redis-demo-consumer

# Voir les messages en attente
docker exec -it redis-demo redis-cli XPENDING events consumer-group - + 10

# Relancer
docker start redis-demo-consumer

# Filtres Chrome DevTools
# url:/api/publish
```

---

### Démo 4 — Locks Distribués

**Scénario** : deux threads concurrents sur un même solde → données corrompues sans verrou → solde correct avec Redis `SETNX`.

```bash
# 100% UI — aucune commande nécessaire

# Voir le verrou en direct (apparaît brièvement pendant l'exécution)
docker exec -it redis-demo redis-cli KEYS "lock:*"

# Filtres Chrome DevTools
# url:/api/debit/concurrent
```

---

### Démo 5 — GeoSpatial

**Scénario** : recherche de villes françaises dans un rayon configurable, réponse en microsecondes depuis Redis.

```bash
# 100% UI — aucune commande nécessaire

# Voir les données géo dans Redis
docker exec -it redis-demo redis-cli ZCARD cities
docker exec -it redis-demo redis-cli GEOPOS cities Paris

# Filtres Chrome DevTools
# url:/api/geo/search
```

---

### Démo 6 — Sessions & TTL

**Problème** : sessions en PostgreSQL avec batch de nettoyage nocturne → dette opérationnelle.  
**Avec Redis** : TTL natif sur chaque clé → expiration automatique, zéro batch.

```bash
# 100% UI — aucune commande nécessaire

# Voir le TTL restant d'une session
docker exec -it redis-demo redis-cli TTL session:<id>

# Filtres Chrome DevTools
# -url:/health
```

---

## Reset entre deux passages

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

# Gateway sans Redis si elle a été stoppée
docker start redis-demo-gateway-no-redis
```

---

## Arrêter la démo

```bash
cd backend

# Tout éteindre
docker compose down

# Éteindre + supprimer les volumes (Redis et PostgreSQL repartent de zéro)
docker compose down -v
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

## Commandes utiles

```bash
# Voir l'état de tous les containers
docker compose ps

# Logs d'un service en temps réel
docker compose logs -f gateway-redis

# Redémarrer un service sans rebuild
docker compose restart gateway-redis

# Rebuilder et relancer un service après modif Java
docker compose up --build gateway-redis -d

# Accès direct Redis CLI
docker exec -it redis-demo redis-cli

# Vider complètement Redis (remet tout à zéro)
docker exec -it redis-demo redis-cli FLUSHALL

# Frontend sur port 3000 déjà occupé
lsof -ti:3000 | xargs kill -9 && npm run dev
```

---

## Autres commandes frontend

```bash
npm run build          # Build de production
npm test               # Tests unitaires (Vitest)
npm run lint           # ESLint
npm run serve:ssr:app  # Servir le build SSR (port 4000)
```

---

## Architecture

```
├── src/                        # Frontend Angular 21 (SSR)
│   └── app/features/
│       ├── gateway/            # Démo 1
│       ├── rate-limiting/      # Démo 2
│       ├── streams/            # Démo 3
│       ├── locks/              # Démo 4
│       ├── geo/                # Démo 5
│       └── ttl/                # Démo 6
└── backend/                    # Services Spring Boot + Docker Compose
    ├── gateway-no-redis/       # :8081
    ├── gateway-redis/          # :8082
    ├── rate-limiting-no-redis/ # :8083
    ├── rate-limiting-redis/    # :8084
    ├── streams-producer/       # :8085/producer
    ├── streams-consumer/       # :8085/consumer
    ├── locks/                  # :8086
    ├── geo/                    # :8087
    └── ttl/                    # :8088
```

Chaque feature Angular appelle directement les backends depuis le navigateur :
- `http://localhost:8081` (ou port pair) → service **sans** Redis
- `http://localhost:8082` (ou port impair) → service **avec** Redis

---

## Sécurité

Le fichier `.env.local` contenant la clé Gemini est exclu du dépôt via `.gitignore`.  
Copier `.env.example` et y renseigner sa propre clé — ne jamais committer `.env.local`.
