# DEMO.md — Cheat Sheet Webinaire Redis

---

## La veille (rebuild si le code a changé)

```bash
cd backend

# Rebuilder un service spécifique après modification du code Java
docker compose up --build gateway-no-redis -d
docker compose up --build gateway-redis -d
# (remplacer par le service modifié)

# Rebuilder tous les services d'un coup
docker compose up --build -d

# Vérifier que tout est UP après rebuild
docker compose ps
```

> **Valider en mode moqué** (sans Docker) :
> ```bash
> npm run start:mocked   # → http://localhost:3000
> ```

---

## 30 minutes avant

```bash
# 1. Démarrer tous les backends + Redis + PostgreSQL
cd backend
docker compose up -d

# 2. Vérifier que tous les containers sont bien UP
docker compose ps

# 3. Vérifier les health checks des services clés
curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/health   # gateway no-redis
curl -s -o /dev/null -w "%{http_code}" http://localhost:8082/health   # gateway redis
curl -s -o /dev/null -w "%{http_code}" http://localhost:8083/health   # rate-limit no-redis
curl -s -o /dev/null -w "%{http_code}" http://localhost:8084/health   # rate-limit redis
curl -s -o /dev/null -w "%{http_code}" http://localhost:8086/health   # locks
curl -s -o /dev/null -w "%{http_code}" http://localhost:8087/health   # geo
curl -s -o /dev/null -w "%{http_code}" http://localhost:8088/health   # ttl
# → tous doivent répondre 200

# 4. Pré-charger les routes initiales dans Redis (gateway avec Redis)
curl -s -X POST http://localhost:8082/api/routes \
  -H "Content-Type: application/json" \
  -d '{"path":"/api/hello","destination":"service-a","active":true,"maintenance":false}'
curl -s -X POST http://localhost:8082/api/routes \
  -H "Content-Type: application/json" \
  -d '{"path":"/api/orders","destination":"service-b","active":true,"maintenance":false}'
curl -s -X POST http://localhost:8082/api/routes \
  -H "Content-Type: application/json" \
  -d '{"path":"/api/users","destination":"service-c","active":true,"maintenance":false}'

# 5. Démarrer le frontend Angular (depuis la racine du projet)
cd ..
npm run dev
# → http://localhost:3000
```

Attendre que toutes les pastilles soient **vertes** dans l'UI avant de commencer.

---

## Reset entre deux démos

```bash
# Reset rate limiting (compteur global)
docker exec -it redis-demo redis-cli DEL rate:global

# Reset routes Redis gateway (remettre l'état initial)
docker exec -it redis-demo redis-cli KEYS "route:*" | xargs docker exec -i redis-demo redis-cli DEL
curl -s -X POST http://localhost:8082/api/routes -H "Content-Type: application/json" \
  -d '{"path":"/api/hello","destination":"service-a","active":true,"maintenance":false}'
curl -s -X POST http://localhost:8082/api/routes -H "Content-Type: application/json" \
  -d '{"path":"/api/orders","destination":"service-b","active":true,"maintenance":false}'
curl -s -X POST http://localhost:8082/api/routes -H "Content-Type: application/json" \
  -d '{"path":"/api/users","destination":"service-c","active":true,"maintenance":false}'

# Reset Redis Streams (vider le stream + relancer le consumer si stoppé)
docker exec -it redis-demo redis-cli DEL events
docker start redis-demo-consumer

# Relancer la gateway no-redis si elle a été stoppée pour la démo
docker start redis-demo-gateway-no-redis
```

---

## Démo 1 — Gateway Dynamique

#### Filtre Chrome (onglet Network)
```
-url:/health -url:/api/routes
```
> Cache les health checks (polling 500ms) et le polling des routes. Ne garde que les appels routés : `/api/hello`, `/api/orders`, `/api/users`, `/api/test`.

**Scénario** : montrer que les routes hardcodées en YAML impliquent un downtime au redémarrage.

```bash
# ÉTAPE 1 — Lancer les deux tirs via l'UI (boutons "Démarrer le tir automatique")
# → toutes les lanes d'endpoints s'animent (Angular → Serveur → Angular)

# ÉTAPE 2 — Simuler un redémarrage de la gateway sans Redis
docker stop redis-demo-gateway-no-redis
# → compteur "Requêtes perdues" monte automatiquement côté gauche
# → les lanes passent en ERR

# Pendant ce temps : ajouter/modifier une route via le formulaire côté droit (avec Redis)
# → la liste se met à jour immédiatement, le tir de droite continue sans interruption

# ÉTAPE 3 — "Redémarrage terminé"
docker start redis-demo-gateway-no-redis
# → pastille repasse verte, les pertes s'arrêtent

# Vérifier les routes dans Redis (optionnel, pour montrer en direct)
docker exec -it redis-demo redis-cli KEYS "route:*"
docker exec -it redis-demo redis-cli HGETALL "route:/api/hello"

# Reset via les boutons refresh dans l'UI avant de passer à la suite
```

---

## Démo 2 — Rate Limiting

#### Filtre Chrome (onglet Network)
```
url:/api/rate/hit
```
> Filtre positif : affiche **uniquement** les appels `/api/rate/hit`. Permet de voir en temps réel les `200` se transformer en `429` dès le dépassement du quota.

**Scénario** : montrer qu'un quota global de 10 est contourné x3 sans Redis.

```bash
# 100% UI — aucune commande terminal nécessaire

# 1. Lancer le tir des deux côtés
# 2. Gauche : les 3 barres montent, le total dépasse 10 sans aucun 429 individuel
# 3. Droite : 429 dès la 11ème requête
# 4. Reset via les boutons refresh dans l'UI

# Si besoin de reset manuel du compteur Redis entre deux passages :
docker exec -it redis-demo redis-cli DEL rate:global
```

---

## Démo 3 — Redis Streams

#### Filtre Chrome (onglet Network)
```
url:/api/publish
```
> Filtre positif : affiche **uniquement** les appels `/api/publish`. Chaque ligne correspond à un message envoyé dans le stream — on voit le rythme de production clairement.

**Scénario** : couper le consommateur en plein traitement, montrer l'accumulation, relancer et voir le rattrapage.

```bash
# ÉTAPE 1 — Lancer la publication automatique via l'UI (bouton "Auto")
# → messages apparaissent dans le Journal, consommateur traite en temps réel

# Vérifier la longueur du stream en live (optionnel, bonne démo redis-cli)
docker exec -it redis-demo redis-cli XLEN events

# ÉTAPE 2 — Couper le consommateur
docker stop redis-demo-consumer
# → pastille consommateur passe rouge
# → badge "En attente" monte et passe rouge
# → laisser tourner 15-20 secondes

# Voir les messages en attente dans le groupe
docker exec -it redis-demo redis-cli XPENDING events consumer-group - + 10

# ÉTAPE 3 — Relancer le consommateur
docker start redis-demo-consumer
# → le consommateur rattrape tous les messages en attente
# → badge "En attente" redescend à 0

# ÉTAPE 4 — Arrêter le tir + Reset via l'UI
```

---

## Démo 4 — Distributed Locks

#### Filtre Chrome (onglet Network)
```
url:/api/debit/concurrent
```
> Filtre positif : affiche **uniquement** les appels `/api/debit/concurrent`. Les deux threads apparaissent simultanément — on voit le chevauchement (race condition) côté gauche, et la sérialisation côté droit.

```bash
# 100% UI — aucune commande terminal nécessaire

# 1. Cliquer "Lancer les 2 threads simultanément" côté gauche
#    → race condition → solde corrompu (500€ au lieu de 0€)
# 2. Cliquer "Réinitialiser à 1000€"
# 3. Cliquer "Lancer les 2 threads simultanément" côté droit
#    → Thread B attend le verrou → solde correct (0€)

# Voir le verrou Redis en direct (pendant l'exécution, il apparaît brièvement)
docker exec -it redis-demo redis-cli KEYS "lock:*"
```

---

## Démo 5 — Geo Spatial

#### Filtre Chrome (onglet Network)
```
url:/api/geo/search
```
> Filtre positif : affiche **uniquement** les requêtes de recherche géospatiale. Chaque ligne correspond à un clic "Rechercher" — on voit le temps de réponse et les paramètres (ville, rayon).

```bash
# 100% UI — aucune commande terminal nécessaire

# 1. Sélectionner une ville centrale (ou cliquer sur la carte)
# 2. Ajuster le rayon avec le slider
# 3. Cliquer "Rechercher"
# → résultats + temps de réponse

# Voir les données géo dans Redis (optionnel)
docker exec -it redis-demo redis-cli ZCARD cities
docker exec -it redis-demo redis-cli GEOPOS cities Paris
```

---

## Démo 6 — TTL & Eviction

#### Filtre Chrome (onglet Network)
```
-url:/health
```
> Cache uniquement les health checks. Tous les appels de sessions restent visibles : créations (`POST`), lectures (`GET`), batch cleanup et expiration — le polling des sessions est lui-même intéressant pour voir les entrées disparaître.

```bash
# 100% UI — aucune commande terminal nécessaire

# 1. Créer des sessions côté gauche (sans TTL)
#    → elles restent indéfiniment, pastille "Active" verte
# 2. Cliquer "Simuler le batch de nettoyage (> 30s)"
#    → supprime les sessions expirées (batch manuel)
# 3. Créer des sessions côté droit avec TTL (ex: 15s)
#    → barres de progression se vident en temps réel
#    → sessions disparaissent automatiquement à expiration, sans batch
# 4. "Réinitialiser la démo" pour repartir de zéro

# Voir le TTL restant d'une session Redis en direct
docker exec -it redis-demo redis-cli TTL session:<id>
# Voir toutes les sessions
docker exec -it redis-demo redis-cli KEYS "session:*"
```

---

## Après la démo

```bash
cd backend

# Tout éteindre proprement
docker compose down

# Éteindre en supprimant aussi les volumes (Redis + PostgreSQL repartent de zéro)
docker compose down -v
```

---

## Commandes utiles en cas de problème

> Les commandes `docker compose` sont à lancer depuis le dossier `backend/`.

```bash
# Voir l'état de tous les services
docker compose ps

# Voir les logs d'un service en temps réel
docker compose logs -f gateway-no-redis
docker compose logs -f gateway-redis
docker compose logs -f streams-consumer
# (remplacer par le nom du service concerné)

# Redémarrer un service spécifique sans rebuild
docker compose restart gateway-redis

# Rebuilder et relancer un service après modif du code Java
docker compose up --build gateway-no-redis -d

# Rebuilder tous les services
docker compose up --build -d

# Accès direct Redis (debug)
docker exec -it redis-demo redis-cli

# Vider complètement Redis (attention : remet tout à zéro)
docker exec -it redis-demo redis-cli FLUSHALL

# Vérifier les routes stockées dans Redis (démo Gateway)
docker exec -it redis-demo redis-cli KEYS "route:*"
docker exec -it redis-demo redis-cli HGETALL "route:/api/hello"

# Vérifier le stream (démo Streams)
docker exec -it redis-demo redis-cli XLEN events

# Voir le compteur rate limiting
docker exec -it redis-demo redis-cli GET rate:global

# Redémarrer le frontend si le port 3000 est déjà occupé
lsof -ti:3000 | xargs kill -9 && npm run dev
```

---

## URLs

| Service | URL |
|---|---|
| Frontend Angular | http://localhost:3000 |
| Gateway sans Redis | http://localhost:8081/health |
| Gateway avec Redis | http://localhost:8082/health |
| Rate Limiting sans Redis | http://localhost:8083/health |
| Rate Limiting avec Redis | http://localhost:8084/health |
| Streams Producer | http://localhost:8085/producer/api/health |
| Streams Consumer | http://localhost:8085/consumer/api/health |
| Locks | http://localhost:8086/health |
| Geo | http://localhost:8087/health |
| TTL | http://localhost:8088/health |

## Noms des containers Docker

| Service | Container |
|---|---|
| Redis | `redis-demo` |
| PostgreSQL | `redis-demo-postgres` |
| Gateway sans Redis | `redis-demo-gateway-no-redis` |
| Gateway avec Redis | `redis-demo-gateway-redis` |
| Rate Limiting sans Redis | `redis-demo-ratelimit-no-redis` |
| Rate Limiting avec Redis | `redis-demo-ratelimit-redis` |
| Streams Producer | `redis-demo-streams-producer` |
| Streams Consumer | `redis-demo-consumer` |
| Streams Proxy (nginx) | `redis-demo-streams-proxy` |
| Locks | `redis-demo-locks` |
| Geo | `redis-demo-geo` |
| TTL | `redis-demo-ttl` |
