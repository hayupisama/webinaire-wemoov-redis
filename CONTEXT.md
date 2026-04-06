# CONTEXT.md — Redis Demo Webinaire

Ce fichier est la source de vérité du projet. Lis-le intégralement avant toute action.

---

## 1. Contexte général

### Ce qu'est ce projet
Application Angular 18+ standalone servant de plateforme visuelle pour un webinaire
technique sur Redis présenté par **Fouad BARA**, développeur chez Wemoov en mission chez France Travail.

L'objectif est pédagogique : montrer objectivement ce que Redis peut apporter sur des cas
d'usage précis, en comparant côte à côte une approche sans Redis et une approche avec Redis.
Redis n'est pas vendu comme une solution magique — chaque démo montre honnêtement le gain
réel et les limites de l'outil.

### Format du webinaire
- 15 min : slides de présentation (diapo HTML standalone)
- 30 min : démos live via cette application Angular
- 5 min : questions/réponses

---

## 2. Les 6 cas d'usage démontrés

### Démo 1 — Gateway Dynamique
**Problème sans Redis** : les routes microservices sont hardcodées dans un fichier
`application.yml` embarqué au build. Toute modification implique une PR + rebuild +
redémarrage de la Gateway. Pendant ce redémarrage, les requêtes en vol sont perdues.

**Avec Redis** : les routes sont stockées dans Redis. La Gateway s'y abonne au démarrage
et recharge à chaud sans interruption. Modifier une route = une écriture dans Redis.
Aucune requête perdue. Idéal pour les coupures d'urgence et les déploiements Blue/Green.

**Note importante** : en production, Redis doit être configuré avec persistance (AOF ou RDB)
pour que les routes survivent à un redémarrage de Redis lui-même.

---

### Démo 2 — Rate Limiting Multi-Instances
**Problème sans Redis** : chaque instance de la Gateway a son propre compteur en mémoire JVM.
Avec 3 instances à 10k req/heure chacune, un client peut consommer 30k req avant qu'une
instance individuelle déclenche le 429. Le quota global n'est jamais respecté.

**Avec Redis** : un seul compteur atomique (`INCR`) partagé entre toutes les instances.
Redis est monothreadé — l'opération est garantie sans race condition. Au dépassement du quota,
toutes les instances répondent HTTP 429 instantanément.

**Nuance honnête** : le rate limiting en soi existe dans n'importe quel reverse proxy.
Ce que Redis apporte ici, c'est la **centralisation du compteur en multi-instances**.

---

### Démo 3 — Redis Streams vs Kafka
**Kafka** : référence du secteur. Rétention infinie, rejeu sur des mois, millions de
messages/sec, réplication multi-broker. Overhead opérationnel élevé (ZooKeeper/KRaft,
brokers, partitions). Justifié quand le besoin est là.

**Redis Streams** : zéro infrastructure supplémentaire si Redis est déjà dans la stack.
Consumer Groups, accusés de réception, persistance des messages le temps du traitement.
Le bon choix quand la complexité de Kafka n'est pas justifiée par le projet.

**Nuance honnête** : Kafka propose aussi la récupération de messages après panne consommateur.
Redis Streams sans persistance (AOF/RDB) peut perdre des messages si Redis lui-même redémarre.
Ce n'est pas un défaut propre aux Streams — c'est une configuration Redis standard à activer.

**Ce que la démo montre** : on coupe littéralement le conteneur Docker du consommateur
en pleine réception. Les messages s'accumulent dans le Stream. On relance le consommateur
— il rattrape tout sans en perdre un seul.

---

### Démo 4 — Locks Distribués
**Contexte** : dans une architecture multi-instances, certaines opérations ne doivent
être exécutées qu'une seule fois à la fois (ex: virement bancaire).

**Problème sans verrou** : deux instances lisent le même solde simultanément, débitent
chacune de leur côté → double débit → données corrompues.

**D'autres solutions existent** : verrous base de données (`SELECT FOR UPDATE`),
transactions strictes. Elles fonctionnent mais ajoutent de la latence BDD et couplent
la logique applicative au SGBD.

**Avec Redis** : `SETNX` — atomique par nature, avec expiration automatique pour éviter
les deadlocks. Simple à implémenter si Redis est déjà dans la stack. Pas la seule solution,
une solution pragmatique.

---

### Démo 5 — GeoSpatial
**PostGIS (PostgreSQL)** : référence pour les données spatiales complexes. Puissant,
mature, adapté aux requêtes spatiales avancées (polygones, intersections, etc.).
Demande d'installer l'extension, créer des index spatiaux, maîtriser des types
géographiques spécifiques. Justifié pour des besoins complexes.

**Redis GEO** : trois commandes suffisent — `GEOADD`, `GEODIST`, `GEOSEARCH`.
Zéro dépendance supplémentaire si Redis est déjà là. Exécuté en RAM, en microsecondes.
Le bon choix pour des besoins de proximité simples, sans sortir un service dédié.

**Ce que la démo montre** : recherche de villes françaises dans un rayon configurable.
La carte SVG se met à jour en temps réel avec les résultats retournés par Redis.

---

### Démo 6 — Sessions & TTL
**Sans TTL natif** : sessions en base PostgreSQL avec un champ `expire_at`. Il faut
un batch nocturne pour nettoyer les sessions expirées. Si le batch rate une nuit,
les sessions mortes s'accumulent, la table grossit, les requêtes ralentissent.

**Avec Redis TTL** : chaque clé peut avoir un chronomètre intégré. À expiration,
Redis détruit la donnée lui-même. Aucun batch, aucune colonne `expire_at`, aucune dette.
`SET session:abc "user42" EX 1800` — dans 30 minutes, la clé n'existe plus.
Fonctionne aussi pour les tokens temporaires, OTP, paniers e-commerce, liens éphémères.

---

## 3. Structure des backends

Chaque démo a ses propres services Spring Boot exposés via Docker Compose.

| Démo           | Sans Redis       | Avec Redis       | Notes                        |
|----------------|------------------|------------------|------------------------------|
| Gateway        | :8081            | :8082            | Spring Boot, routes YAML vs Redis |
| Rate Limiting  | :8083            | :8084            | Spring Boot, AtomicInt vs INCR |
| Streams        | :8085/producer   | :8085/consumer   | Deux apps dans le même compose |
| Locks          | :8086/no-lock    | :8086/with-lock  | Même app, deux endpoints     |
| GeoSpatial     | :8087            | :8087            | Redis uniquement             |
| Sessions TTL   | :8088/no-ttl     | :8088/with-ttl   | PostgreSQL vs Redis          |

Base URL configurable dans `environment.ts`.

---

## 4. Design System (non négociable)

Toutes les interfaces respectent strictement la DA de la diapo de présentation.

```scss
// CSS Variables — à définir dans styles.scss
--primary-color: #677ec7;   // bleu — éléments "avec Redis"
--accent-color:  #f05c4b;   // rouge/corail — alertes, "sans Redis", erreurs
--bg-color:      #0f172a;   // background global
--tile-bg:       #1e293b;   // surface des cartes et panneaux
--text-light:    #ffffff;   // texte principal
--text-muted:    #94a3b8;   // texte secondaire
--border:        #334155;   // bordures
```

**Typographie**
- Titres : `Poppins` (700)
- Corps : `DM Sans` (400/500)
- Code inline : monospace, background `#0f172a`, padding `2px 8px`, border-radius `6px`

**Composants**
- Cards : background `--tile-bg`, border `1px solid --border`, border-radius `16px`
- Badges statut : border-radius `50px`, padding `4px 16px`
- Barres de progression : hauteur `8px`, border-radius `4px`, transition `0.3s ease`
- Boutons primaires : background `--primary-color`, border-radius `12px`
- Boutons danger : background `--accent-color`, border-radius `12px`
- Encarts informatifs : border-left `4px solid --primary-color` ou `--accent-color`

**Conventions visuelles**
- Colonne "Sans Redis" → toujours à gauche, accent `--accent-color` (`#f05c4b`)
- Colonne "Avec Redis" → toujours à droite, accent `--primary-color` (`#677ec7`)
- Pastille statut en ligne : `#22c55e` (vert)
- Pastille statut hors ligne : `#f05c4b` (rouge)
- Badge HTTP 200 : vert `#22c55e`
- Badge HTTP 429 : rouge `#f05c4b`

---

## 5. Stack technique Angular

```
Angular        : 18+ (standalone components uniquement, pas de NgModules)
State          : Angular Signals
Flux HTTP      : RxJS (interval + switchMap pour les pollings)
UI components  : Angular Material
Layout/utils   : Tailwind CSS
TypeScript     : strict, pas de `any`
```

**Structure de dossiers**
```
src/
  app/
    core/
      services/           ← services HTTP partagés si besoin
    features/
      gateway/            ← démo 1
      rate-limiting/      ← démo 2
      streams/            ← démo 3
      locks/              ← démo 4
      geo/                ← démo 5
      ttl/                ← démo 6
    shared/
      components/         ← composants réutilisables
  environments/
    environment.ts        ← baseUrls par service
```

**Règles de code**
- Un composant = un fichier (template inline si < 30 lignes de HTML, sinon fichier séparé)
- Services séparés par domaine fonctionnel
- Polling via `RxJS interval + switchMap`, nettoyé dans `ngOnDestroy`
- Méthodes publiques documentées avec JSDoc minimale
- Ne pas modifier ce qui ne fait pas l'objet de la demande

---

## 6. Comportements UI communs à toutes les démos

- **Polling santé backend** : toutes les 500ms via GET `/health`
  Pastille verte "En ligne" / rouge "Hors ligne"
- **Polling données** : fréquence variable selon la démo (voir détails par démo)
- **Animations** : transitions CSS uniquement, pas de lib d'animation externe
- **Erreurs HTTP** : affichées inline dans le panneau concerné, jamais en alert() ou console only
- **Reset** : chaque démo a un bouton de reset pour pouvoir rejouer la démonstration

---

## 7. Ce que cette application n'est pas

- Pas une app de production
- Pas une vitrine commerciale de Redis
- Pas une simulation : les pannes se font via `docker stop`, pas via un bouton UI
- Pas une comparaison biaisée : chaque côté "sans Redis" est une implémentation correcte
  et honnête de l'alternative, pas une version volontairement dégradée

---

## 8. Instruction de travail pour Claude Code

Avant toute modification :
1. Lis ce fichier
2. Identifie le composant ou service concerné
3. Ne modifie que ce qui est demandé
4. Respecte le design system sans exception
5. Signale toute incohérence trouvée dans le code existant avant de la corriger

Format de réponse attendu :
- Code uniquement, pas de prose autour
- En fin de réponse : "Fichiers modifiés : ..." et "Prochaine étape suggérée : ..."