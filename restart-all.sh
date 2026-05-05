#!/bin/bash
# restart-all.sh — Levanta todo el stack de cero:
#   Anvil → deploy contratos → 4 apps Next.js
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RPC_URL="http://localhost:8545"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ─────────────────────────────────────────
# 1. Matar procesos previos
# ─────────────────────────────────────────
echo -e "${BLUE}[1/5] Deteniendo procesos previos...${NC}"
pkill -f anvil  2>/dev/null || true
pkill -f "next" 2>/dev/null || true
sleep 1
echo -e "${GREEN}  ✅ Procesos anteriores detenidos${NC}"
echo ""

# ─────────────────────────────────────────
# 2. Levantar Anvil
# ─────────────────────────────────────────
echo -e "${BLUE}[2/5] Iniciando Anvil...${NC}"
anvil --host 0.0.0.0 --hardfork london --disable-code-size-limit \
    > /tmp/anvil.log 2>&1 &
ANVIL_PID=$!

# Esperar a que Anvil esté listo (max 10 s)
for i in $(seq 1 10); do
    if cast block-number --rpc-url "${RPC_URL}" > /dev/null 2>&1; then
        break
    fi
    sleep 1
    if [ "$i" -eq 10 ]; then
        echo -e "${RED}❌ Anvil no arrancó en 10 s. Ver /tmp/anvil.log${NC}"
        exit 1
    fi
done
echo -e "${GREEN}  ✅ Anvil activo (PID ${ANVIL_PID}) → ${RPC_URL}${NC}"
echo ""

# ─────────────────────────────────────────
# 3. Deploy contratos + escritura .env.local
# ─────────────────────────────────────────
echo -e "${BLUE}[3/5] Desplegando contratos...${NC}"
bash "${SCRIPT_DIR}/deploy.sh"
echo ""

# ─────────────────────────────────────────
# 4. Lanzar las 4 apps en background
# ─────────────────────────────────────────
echo -e "${BLUE}[4/5] Iniciando aplicaciones...${NC}"

start_app() {
    local name="$1"
    local dir="$2"
    local port="$3"
    local log="/tmp/${name}.log"

    cd "${SCRIPT_DIR}/${dir}"
    npm run dev > "${log}" 2>&1 &
    echo -e "  ${YELLOW}→ ${name}${NC} (puerto ${port})  log: ${log}"
    cd "${SCRIPT_DIR}"
}

start_app "compra-stablecoin" "stablecoin/compra-stableboin" 6001
start_app "pasarela-pago"     "stablecoin/pasarela-de-pago"  6002
start_app "web-admin"         "web-admin"                    6003
start_app "web-customer"      "web-customer"                 6004

echo ""

# ─────────────────────────────────────────
# 5. Healthchecks (hasta 60 s por servicio)
# ─────────────────────────────────────────
echo -e "${BLUE}[5/5] Verificando servicios...${NC}"

wait_for_port() {
    local name="$1"
    local url="$2"
    for i in $(seq 1 60); do
        if curl -s --max-time 2 "${url}" > /dev/null 2>&1; then
            echo -e "  ${GREEN}✅ ${name}${NC}"
            return 0
        fi
        sleep 1
    done
    echo -e "  ${RED}❌ ${name} no respondió en 60 s. Ver /tmp/${name}.log${NC}"
    return 1
}

wait_for_port "compra-stablecoin  → :6001" "http://localhost:6001"
wait_for_port "pasarela-pago      → :6002" "http://localhost:6002"
wait_for_port "web-admin          → :6003" "http://localhost:6003"
wait_for_port "web-customer       → :6004" "http://localhost:6004"

echo ""

# Verificar el contrato EuroToken
EURO_TOKEN_ADDRESS=$(grep "^NEXT_PUBLIC_EURO_TOKEN_ADDRESS=" \
    "${SCRIPT_DIR}/web-admin/.env.local" | cut -d'=' -f2-)
if [ -n "${EURO_TOKEN_ADDRESS}" ]; then
    DECIMALS=$(cast call "${EURO_TOKEN_ADDRESS}" "decimals()(uint8)" \
        --rpc-url "${RPC_URL}" 2>/dev/null || echo "?")
    echo -e "  ${GREEN}✅ EuroToken decimals: ${DECIMALS}${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Stack completo levantado${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  Compra Stablecoin  →  http://localhost:6001"
echo -e "  Pasarela de Pago   →  http://localhost:6002"
echo -e "  Web Admin          →  http://localhost:6003"
echo -e "  Web Customer       →  http://localhost:6004"
echo -e "  Anvil RPC          →  http://localhost:8545"
echo ""
echo -e "  Logs en /tmp/<app>.log  |  Anvil: /tmp/anvil.log"
