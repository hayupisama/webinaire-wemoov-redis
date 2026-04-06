#!/usr/bin/env bash
# =============================================================================
#  REDIS DEMO PLATFORM — Script de pilotage interactif
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

if [[ ! -d "$BACKEND_DIR" ]]; then
  echo "Erreur : dossier backend/ introuvable. Lancez ce script depuis la racine du projet."
  exit 1
fi

# ─── Couleurs ─────────────────────────────────────────────────────────────────
R='\033[0;31m'   # rouge
G='\033[0;32m'   # vert
Y='\033[1;33m'   # jaune
B='\033[0;34m'   # bleu
C='\033[0;36m'   # cyan
W='\033[1;37m'   # blanc gras
D='\033[2m'      # dim
N='\033[0m'      # reset

# ─── Utilitaires ──────────────────────────────────────────────────────────────
header() {
  clear
  echo -e "${B}${W}"
  echo "  ╔══════════════════════════════════════════════╗"
  echo "  ║        REDIS DEMO PLATFORM — MENU            ║"
  echo "  ╚══════════════════════════════════════════════╝"
  echo -e "${N}"
}

section() { echo -e "\n${C}${W}  $1${N}"; }
ok()      { echo -e "  ${G}✓${N}  $1"; }
warn()    { echo -e "  ${Y}⚠${N}  $1"; }
err()     { echo -e "  ${R}✗${N}  $1"; }
info()    { echo -e "  ${D}→${N}  $1"; }

pause() {
  echo ""
  read -rp "$(echo -e "  ${D}Appuyer sur Entrée pour continuer...${N}")"
}

confirm() {
  echo -en "\n  ${Y}⚠  $1 ${R}[o/N]${N} "
  read -r reply
  [[ "$reply" =~ ^[oO]$ ]]
}

choose() {
  echo -en "\n  ${W}Choix :${N} "
  read -r REPLY
}

# docker compose avec chemin absolu
dc() { docker compose -f "$BACKEND_DIR/docker-compose.yml" "$@"; }

# ─── Fonctions métier ─────────────────────────────────────────────────────────
check_all_health() {
  section "Health checks"
  local -A services=(
    ["Gateway sans Redis"]="http://localhost:8081/health"
    ["Gateway avec Redis"]="http://localhost:8082/health"
    ["Rate Limit sans Redis"]="http://localhost:8083/health"
    ["Rate Limit avec Redis"]="http://localhost:8084/health"
    ["Streams Producer"]="http://localhost:8085/producer/api/health"
    ["Streams Consumer"]="http://localhost:8085/consumer/api/health"
    ["Locks"]="http://localhost:8086/health"
    ["Geo"]="http://localhost:8087/health"
    ["TTL"]="http://localhost:8088/health"
  )
  local order=(
    "Gateway sans Redis" "Gateway avec Redis"
    "Rate Limit sans Redis" "Rate Limit avec Redis"
    "Streams Producer" "Streams Consumer"
    "Locks" "Geo" "TTL"
  )
  for name in "${order[@]}"; do
    local url="${services[$name]}"
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "$url" 2>/dev/null || echo "000")
    if [[ "$code" == "200" ]]; then
      ok "$name"
    else
      err "$name  ${D}(HTTP $code)${N}"
    fi
  done
}

seed_gateway_routes() {
  section "Seed routes initiales → Redis (gateway port 8082)"
  local -a routes=(
    '{"path":"/api/hello","destination":"service-a","active":true,"maintenance":false}'
    '{"path":"/api/orders","destination":"service-b","active":true,"maintenance":false}'
    '{"path":"/api/users","destination":"service-c","active":true,"maintenance":false}'
  )
  for route in "${routes[@]}"; do
    local path code
    path=$(echo "$route" | grep -o '"path":"[^"]*"' | cut -d'"' -f4)
    code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 \
      -X POST http://localhost:8082/api/routes \
      -H "Content-Type: application/json" \
      -d "$route" 2>/dev/null || echo "000")
    if [[ "$code" == "200" || "$code" == "201" ]]; then
      ok "$path → service-* (HTTP $code)"
    else
      err "$path → échec (HTTP $code) — gateway-redis démarrée ?"
    fi
  done
}

start_frontend() {
  section "Démarrage du frontend"
  if lsof -ti:3000 > /dev/null 2>&1; then
    warn "Port 3000 déjà occupé."
    if confirm "Tuer le processus existant et relancer ?"; then
      lsof -ti:3000 | xargs kill -9 2>/dev/null || true
      sleep 1
    else
      info "Frontend non relancé."
      return
    fi
  fi
  cd "$SCRIPT_DIR"
  npm run dev &
  info "Frontend lancé en arrière-plan  →  http://localhost:3000"
  info "(Ctrl+C dans ce terminal ne le tue pas — utiliser l'option Arrêt du frontend)"
}

stop_frontend() {
  if lsof -ti:3000 > /dev/null 2>&1; then
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    ok "Frontend arrêté (port 3000 libéré)"
  else
    warn "Rien ne tourne sur le port 3000"
  fi
}

redis_cli_cmd() {
  docker exec -it redis-demo redis-cli "$@"
}

# ─── SETUP ────────────────────────────────────────────────────────────────────
menu_setup() {
  while true; do
    header
    section "SETUP"
    echo "  1) Démarrer tous les services (docker compose up -d)"
    echo "  2) Vérifier les health checks"
    echo "  3) Seed routes initiales dans Redis (gateway)"
    echo "  4) Démarrer le frontend Angular"
    echo "  5) Arrêter le frontend Angular"
    echo -e "  ${D}─────────────────────────────────────────${N}"
    echo "  6) Tout préparer d'un coup  (1 + 2 + 3 + 4)"
    echo -e "  ${D}─────────────────────────────────────────${N}"
    echo "  0) ← Retour"
    choose
    case "$REPLY" in
      1)
        section "Démarrage des services"
        dc up -d
        ok "Services démarrés"
        pause ;;
      2)
        check_all_health
        pause ;;
      3)
        seed_gateway_routes
        pause ;;
      4)
        start_frontend
        pause ;;
      5)
        stop_frontend
        pause ;;
      6)
        section "Démarrage des services"
        dc up -d
        ok "Services démarrés — attente 5s que les apps soient prêtes..."
        sleep 5
        check_all_health
        seed_gateway_routes
        start_frontend
        pause ;;
      0) return ;;
    esac
  done
}

# ─── REBUILD ──────────────────────────────────────────────────────────────────
menu_rebuild() {
  local -a service_names=(
    "gateway-no-redis" "gateway-redis"
    "rate-limiting-no-redis" "rate-limiting-redis"
    "streams-producer" "streams-consumer"
    "locks" "geo" "ttl"
  )
  while true; do
    header
    section "REBUILD (après modification du code Java)"
    local i=1
    for s in "${service_names[@]}"; do
      echo "  $i) $s"
      ((i++))
    done
    echo "  $i) Tous les services"
    echo -e "  ${D}─────────────────────────────────────────${N}"
    echo "  0) ← Retour"
    choose
    if [[ "$REPLY" == "0" ]]; then return; fi

    local all_count=${#service_names[@]}
    if [[ "$REPLY" == "$((all_count + 1))" ]]; then
      if confirm "Rebuilder TOUS les services ? (peut prendre plusieurs minutes)"; then
        section "Rebuild de tous les services"
        dc up --build -d
        ok "Rebuild terminé"
      fi
    elif [[ "$REPLY" =~ ^[0-9]+$ ]] && (( REPLY >= 1 && REPLY <= all_count )); then
      local svc="${service_names[$((REPLY - 1))]}"
      section "Rebuild de $svc"
      dc up --build "$svc" -d
      ok "$svc rebuildé et relancé"
    fi
    pause
  done
}

# ─── DÉMO 1 — GATEWAY ─────────────────────────────────────────────────────────
menu_demo1() {
  while true; do
    header
    section "DÉMO 1 — Gateway Dynamique"
    echo -e "  ${D}Filtre Chrome Network :${N}"
    echo -e "  ${D}-url:localhost:8081/health -url:localhost:8082/health -url:localhost:8082/api/routes -url:localhost:8081/api/routes${N}"
    echo ""
    echo "  1) Stopper la gateway sans Redis"
    echo "  2) Rebuild + relancer la gateway sans Redis"
    echo "  3) Stopper → rebuild → relancer  (enchaînement complet)"
    echo "  4) Voir les routes stockées dans Redis"
    echo "  5) Voir le détail d'une route Redis  (/api/hello)"
    echo "  6) Reset des routes Redis + re-seed"
    echo -e "  ${D}─────────────────────────────────────────${N}"
    echo "  0) ← Retour"
    choose
    case "$REPLY" in
      1)
        section "Stop gateway-no-redis"
        dc stop gateway-no-redis
        ok "Container stoppé"
        pause ;;
      2)
        section "Rebuild + relance gateway-no-redis"
        dc up --build gateway-no-redis -d
        ok "Container rebuildé et relancé"
        pause ;;
      3)
        section "Arrêt gateway-no-redis"
        dc stop gateway-no-redis
        ok "Container stoppé"
        info "Pause 700ms..."
        sleep 0.7
        section "Rebuild + relance gateway-no-redis"
        dc up --build gateway-no-redis -d
        ok "Container rebuildé et relancé — attendre que la pastille repasse verte"
        pause ;;
      4)
        section "Routes dans Redis"
        redis_cli_cmd KEYS "route:*"
        pause ;;
      5)
        section "Détail route /api/hello"
        redis_cli_cmd HGETALL "route:/api/hello"
        pause ;;
      6)
        section "Reset routes Redis"
        local keys
        keys=$(docker exec redis-demo redis-cli KEYS "route:*" 2>/dev/null)
        if [[ -n "$keys" ]]; then
          echo "$keys" | xargs docker exec -i redis-demo redis-cli DEL
          ok "Routes supprimées"
        else
          warn "Aucune route à supprimer"
        fi
        seed_gateway_routes
        pause ;;
      0) return ;;
    esac
  done
}

# ─── DÉMO 2 — RATE LIMITING ───────────────────────────────────────────────────
menu_demo2() {
  while true; do
    header
    section "DÉMO 2 — Rate Limiting"
    echo -e "  ${D}Filtre Chrome Network :${N}"
    echo -e "  ${D}-url:localhost:8083/health -url:localhost:8084/health${N}"
    echo ""
    echo "  1) Voir le compteur global Redis"
    echo "  2) Reset compteur global Redis  (DEL rate:global)"
    echo -e "  ${D}─────────────────────────────────────────${N}"
    echo "  0) ← Retour"
    choose
    case "$REPLY" in
      1)
        section "Compteur rate limiting"
        local val
        val=$(docker exec redis-demo redis-cli GET rate:global 2>/dev/null || echo "(nil)")
        info "rate:global = ${W}$val${N}"
        pause ;;
      2)
        section "Reset compteur"
        docker exec redis-demo redis-cli DEL rate:global
        ok "Compteur remis à zéro"
        pause ;;
      0) return ;;
    esac
  done
}

# ─── DÉMO 3 — STREAMS ─────────────────────────────────────────────────────────
menu_demo3() {
  while true; do
    header
    section "DÉMO 3 — Redis Streams"
    echo -e "  ${D}Filtre Chrome Network :${N}"
    echo -e "  ${D}-url:localhost:8085/producer/api/health -url:localhost:8085/consumer/api/health${N}"
    echo ""
    echo "  1) Stopper le consommateur"
    echo "  2) Relancer le consommateur"
    echo "  3) Voir la longueur du stream  (XLEN events)"
    echo "  4) Voir les messages en attente  (XPENDING)"
    echo "  5) Vider le stream  (DEL events)"
    echo -e "  ${D}─────────────────────────────────────────${N}"
    echo "  0) ← Retour"
    choose
    case "$REPLY" in
      1)
        section "Stop consumer"
        dc stop streams-consumer
        ok "Consumer stoppé — les messages vont s'accumuler"
        pause ;;
      2)
        section "Start consumer"
        dc start streams-consumer
        ok "Consumer relancé — il va rattraper les messages en attente"
        pause ;;
      3)
        section "Longueur du stream"
        local len
        len=$(docker exec redis-demo redis-cli XLEN events 2>/dev/null || echo "0")
        info "events → ${W}$len messages${N}"
        pause ;;
      4)
        section "Messages en attente (consumer-group)"
        redis_cli_cmd XPENDING events consumer-group - + 10
        pause ;;
      5)
        if confirm "Vider complètement le stream events ?"; then
          docker exec redis-demo redis-cli DEL events
          ok "Stream vidé"
        fi
        pause ;;
      0) return ;;
    esac
  done
}

# ─── DÉMO 4 — LOCKS ───────────────────────────────────────────────────────────
menu_demo4() {
  while true; do
    header
    section "DÉMO 4 — Distributed Locks"
    echo -e "  ${D}Filtre Chrome Network :${N}"
    echo -e "  ${D}-url:localhost:8086/health${N}"
    echo ""
    echo "  1) Voir les verrous Redis actifs  (KEYS lock:*)"
    echo "  2) Voir le solde du compte partagé"
    echo -e "  ${D}─────────────────────────────────────────${N}"
    echo "  0) ← Retour"
    choose
    case "$REPLY" in
      1)
        section "Verrous actifs"
        redis_cli_cmd KEYS "lock:*"
        pause ;;
      2)
        section "Solde compte partagé"
        redis_cli_cmd KEYS "account:*"
        pause ;;
      0) return ;;
    esac
  done
}

# ─── DÉMO 5 — GEO ─────────────────────────────────────────────────────────────
menu_demo5() {
  while true; do
    header
    section "DÉMO 5 — Geo Spatial"
    echo -e "  ${D}Filtre Chrome Network :${N}"
    echo -e "  ${D}-url:localhost:8087/health${N}"
    echo ""
    echo "  1) Nombre de villes indexées  (ZCARD cities)"
    echo "  2) Position GPS de Paris"
    echo "  3) Position GPS de Lyon"
    echo -e "  ${D}─────────────────────────────────────────${N}"
    echo "  0) ← Retour"
    choose
    case "$REPLY" in
      1)
        section "Villes dans Redis"
        local count
        count=$(docker exec redis-demo redis-cli ZCARD cities 2>/dev/null || echo "0")
        info "cities → ${W}$count entrées${N}"
        pause ;;
      2)
        section "GEOPOS Paris"
        redis_cli_cmd GEOPOS cities Paris
        pause ;;
      3)
        section "GEOPOS Lyon"
        redis_cli_cmd GEOPOS cities Lyon
        pause ;;
      0) return ;;
    esac
  done
}

# ─── DÉMO 6 — TTL ─────────────────────────────────────────────────────────────
menu_demo6() {
  while true; do
    header
    section "DÉMO 6 — TTL & Eviction"
    echo -e "  ${D}Filtre Chrome Network :${N}"
    echo -e "  ${D}-url:localhost:8088/health${N}"
    echo ""
    echo "  1) Voir toutes les sessions actives  (KEYS session:*)"
    echo "  2) TTL d'une session  (saisir l'ID)"
    echo "  3) Nombre de sessions actives"
    echo -e "  ${D}─────────────────────────────────────────${N}"
    echo "  0) ← Retour"
    choose
    case "$REPLY" in
      1)
        section "Sessions Redis"
        redis_cli_cmd KEYS "session:*"
        pause ;;
      2)
        echo -en "\n  ID de session : "
        read -r sid
        section "TTL de session:$sid"
        redis_cli_cmd TTL "session:$sid"
        pause ;;
      3)
        section "Nombre de sessions"
        local count
        count=$(docker exec redis-demo redis-cli KEYS "session:*" 2>/dev/null | wc -l)
        info "${W}$count session(s)${N} dans Redis"
        pause ;;
      0) return ;;
    esac
  done
}

# ─── MAINTENANCE ──────────────────────────────────────────────────────────────
menu_maintenance() {
  while true; do
    header
    section "MAINTENANCE"
    echo "  1) État de tous les containers  (docker compose ps)"
    echo "  2) Logs d'un service  (temps réel)"
    echo "  3) Redémarrer un service  (sans rebuild)"
    echo "  4) Accès Redis CLI interactif"
    echo "  5) FLUSHALL Redis  ⚠ efface tout"
    echo -e "  ${D}─────────────────────────────────────────${N}"
    echo "  0) ← Retour"
    choose
    case "$REPLY" in
      1)
        section "État des containers"
        dc ps
        pause ;;
      2)
        echo ""
        echo -e "  Services disponibles :"
        echo "  gateway-no-redis / gateway-redis"
        echo "  rate-limiting-no-redis / rate-limiting-redis"
        echo "  streams-producer / streams-consumer / streams-proxy"
        echo "  locks / geo / ttl / redis / postgres"
        echo -en "\n  Nom du service : "
        read -r svc
        section "Logs de $svc  (Ctrl+C pour quitter)"
        dc logs -f "$svc" ;;
      3)
        echo -en "\n  Nom du service : "
        read -r svc
        section "Restart de $svc"
        dc restart "$svc"
        ok "$svc redémarré"
        pause ;;
      4)
        section "Redis CLI  (type 'exit' pour quitter)"
        redis_cli_cmd ;;
      5)
        if confirm "FLUSHALL — supprimer TOUTES les données Redis ?"; then
          docker exec redis-demo redis-cli FLUSHALL
          ok "Redis vidé"
          warn "Pensez à re-seeder les routes gateway (menu Setup → 3)"
        fi
        pause ;;
      0) return ;;
    esac
  done
}

# ─── ARRÊT ────────────────────────────────────────────────────────────────────
menu_arret() {
  while true; do
    header
    section "ARRÊT"
    echo "  1) Arrêter tous les containers  (docker compose down)"
    echo "  2) Arrêter + supprimer les volumes  ⚠ repart de zéro (down -v)"
    echo "  3) Arrêter le frontend Angular  (libère le port 3000)"
    echo -e "  ${D}─────────────────────────────────────────${N}"
    echo "  0) ← Retour"
    choose
    case "$REPLY" in
      1)
        section "Arrêt des containers"
        dc down
        ok "Tous les containers stoppés"
        pause ;;
      2)
        if confirm "Supprimer aussi les volumes (données Redis + PostgreSQL) ?"; then
          dc down -v
          ok "Containers et volumes supprimés"
        fi
        pause ;;
      3)
        stop_frontend
        pause ;;
      0) return ;;
    esac
  done
}

# ─── MENU PRINCIPAL ───────────────────────────────────────────────────────────
main() {
  while true; do
    header
    section "QUE VOULEZ-VOUS FAIRE ?"
    echo ""
    echo "  1) Setup               (démarrer, health checks, seed Redis)"
    echo "  2) Rebuild             (après modification du code Java)"
    echo -e "  ${D}─────────────────────────────────────────${N}"
    echo "  3) Démo 1  —  Gateway Dynamique"
    echo "  4) Démo 2  —  Rate Limiting"
    echo "  5) Démo 3  —  Redis Streams"
    echo "  6) Démo 4  —  Distributed Locks"
    echo "  7) Démo 5  —  Geo Spatial"
    echo "  8) Démo 6  —  TTL & Eviction"
    echo -e "  ${D}─────────────────────────────────────────${N}"
    echo "  9) Maintenance         (logs, redis-cli, état containers)"
    echo "  0) Arrêt"
    echo ""
    choose
    case "$REPLY" in
      1) menu_setup ;;
      2) menu_rebuild ;;
      3) menu_demo1 ;;
      4) menu_demo2 ;;
      5) menu_demo3 ;;
      6) menu_demo4 ;;
      7) menu_demo5 ;;
      8) menu_demo6 ;;
      9) menu_maintenance ;;
      0) menu_arret ;;
      q|Q)
        clear
        ok "À bientôt !"
        echo ""
        exit 0 ;;
    esac
  done
}

main
