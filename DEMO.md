# DEMO.md — Cheat Sheet Webinaire Redis

## 30 minutes avant

```bash
# 1. Démarrer tous les backends + Redis + PostgreSQL
docker compose up -d

# 2. Vérifier que tout est up
docker compose ps

# 3. Démarrer le frontend Angular
npm run dev
# → http://localhost:3000
```

Attendre que toutes les pastilles soient **vertes** dans l'UI avant de commencer.

---

## Démo 1 — Gateway Dynamique

**Scénario** : montrer que les routes hardcodées en YAML impliquent un downtime au redémarrage.

```bash
# ÉTAPE 1 — Les deux tirs sont lancés via l'UI (boutons "Démarrer le tir automatique")

# ÉTAPE 2 — Simuler un redémarrage de la gateway sans Redis
docker stop gateway-no-redis
# → compteur "Requêtes perdues" monte automatiquement côté gauche

# Pendant ce temps : modifier une route via le formulaire côté droit (avec Redis)
# → la liste se met à jour immédiatement, le tir de droite continue sans interruption

# ÉTAPE 3 — "Redémarrage terminé"
docker start gateway-no-redis
# → pastille repasse verte, les pertes s'arrêtent

# Reset via les boutons refresh dans l'UI avant de passer à la suite
```

---

## Démo 2 — Rate Limiting

**Scénario** : montrer qu'un quota global de 10 est contourné x3 sans Redis.

```bash
# 100% UI — aucune commande terminal nécessaire

# 1. Lancer le tir des deux côtés
# 2. Gauche : les 3 barres montent, le total dépasse 10 sans aucun 429 individuel
# 3. Droite : 429 dès la 11ème requête
# 4. Reset via les boutons refresh dans l'UI
```

---

## Démo 3 — Redis Streams

**Scénario** : couper le consommateur en plein traitement, montrer l'accumulation, relancer et voir le rattrapage.

```bash
# ÉTAPE 1 — Lancer la publication automatique via l'UI (bouton "Auto")
# → messages apparaissent dans le Journal, consommateur traite en temps réel

# ÉTAPE 2 — Couper le consommateur
docker stop redis-demo-consumer
# → pastille consommateur passe rouge
# → badge "En attente" monte et passe rouge
# → laisser tourner 15-20 secondes

# ÉTAPE 3 — Relancer le consommateur
docker start redis-demo-consumer
# → le consommateur rattrape tous les messages en attente
# → badge "En attente" redescend à 0

# ÉTAPE 4 — Arrêter le tir + Reset via l'UI
```

---

## Démo 4 — Distributed Locks

```bash
# 100% UI — aucune commande terminal nécessaire

# 1. Cliquer "Lancer les 2 threads simultanément" côté gauche
#    → race condition → solde corrompu (500€ au lieu de 0€)
# 2. Cliquer "Réinitialiser à 1000€"
# 3. Cliquer "Lancer les 2 threads simultanément" côté droit
#    → Thread B attend le verrou → solde correct (0€)
```

---

## Démo 5 — Geo Spatial

```bash
# 100% UI — aucune commande terminal nécessaire

# 1. Sélectionner une ville centrale (ou cliquer sur la carte)
# 2. Ajuster le rayon avec le slider
# 3. Cliquer "Rechercher"
# → résultats + temps de réponse
```

---

## Démo 6 — TTL & Eviction

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
```

---

## Commandes utiles en cas de problème

```bash
# Voir l'état de tous les services
docker compose ps

# Voir les logs d'un service en temps réel
docker compose logs -f gateway-redis
docker compose logs -f streams-consumer
# (remplacer par le nom du service concerné)

# Redémarrer un service spécifique
docker compose restart gateway-redis

# Tout éteindre et tout rallumer
docker compose down && docker compose up -d

# Accès direct Redis (debug)
docker exec -it redis redis-cli

# Vérifier les routes stockées dans Redis (démo Gateway)
docker exec -it redis redis-cli KEYS "route:*"

# Vérifier le stream (démo Streams)
docker exec -it redis redis-cli XLEN events

# Voir le compteur rate limiting
docker exec -it redis redis-cli GET rate:global
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
