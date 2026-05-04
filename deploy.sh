#!/bin/bash

# Deploy script: EuroToken (stablecoin/sc) + EcommerceMain (sc-ecommerce)
# Actualiza .env.local de todas las apps
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RPC_URL="http://localhost:8545"
PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
DEPLOYER="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

COMPRA_ENV="${SCRIPT_DIR}/stablecoin/compra-stableboin/.env.local"
PASARELA_ENV="${SCRIPT_DIR}/stablecoin/pasarela-de-pago/.env.local"
ECOMMERCE_ENV="${SCRIPT_DIR}/sc-ecommerce/.env"
WEB_ADMIN_ENV="${SCRIPT_DIR}/web-admin/.env.local"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Stablecoin + Ecommerce Deploy${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# --- Anvil: verificar estado ---
echo -e "${BLUE}Verificando Anvil en ${RPC_URL}...${NC}"
if cast block-number --rpc-url ${RPC_URL} > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Anvil activo en ${RPC_URL}${NC}"
else
    echo -e "${RED}❌ Anvil no está disponible en ${RPC_URL}${NC}"
    echo -e "${YELLOW}   Inícialo manualmente:${NC}"
    echo -e "   anvil --hardfork london --disable-code-size-limit"
    exit 1
fi
echo ""

# ─────────────────────────────────────────
# Leer/pedir Stripe keys
# ─────────────────────────────────────────
is_placeholder() {
    [[ -z "$1" || "$1" == *"REEMPLAZA"* || "$1" == "pk_test_..." || "$1" == "sk_test_..." || "$1" == "whsec_..." ]]
}

get_env_value() {
    local key="$1"
    grep "^${key}=" "${COMPRA_ENV}" 2>/dev/null | cut -d'=' -f2-
}

STRIPE_PK=$(get_env_value "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")
STRIPE_SK=$(get_env_value "STRIPE_SECRET_KEY")
STRIPE_WH=$(get_env_value "STRIPE_WEBHOOK_SECRET")
WALLET_PK=$(get_env_value "WALLET_PRIVATE_KEY")

echo -e "${BLUE}Verificando Stripe keys...${NC}"

if is_placeholder "$STRIPE_PK"; then
    read -r -p "  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_test_...): " STRIPE_PK
fi
if is_placeholder "$STRIPE_SK"; then
    read -r -p "  STRIPE_SECRET_KEY (sk_test_...): " STRIPE_SK
fi
if is_placeholder "$STRIPE_WH"; then
    read -r -p "  STRIPE_WEBHOOK_SECRET (whsec_...): " STRIPE_WH
fi
if is_placeholder "$WALLET_PK"; then
    echo -e "  ${YELLOW}WALLET_PRIVATE_KEY no configurada. Usando la clave del deployer de Anvil.${NC}"
    WALLET_PK="${PRIVATE_KEY}"
fi

echo ""

# ─────────────────────────────────────────
# 1. Deploy EuroToken via forge script
# ─────────────────────────────────────────
echo -e "${BLUE}[1/3] Desplegando EuroToken...${NC}"
cd "${SCRIPT_DIR}/stablecoin/sc"

EURO_OUTPUT=$(DEPLOYER_ADDRESS=${DEPLOYER} forge script script/DeployEuroToken.s.sol \
    --rpc-url ${RPC_URL} \
    --private-key ${PRIVATE_KEY} \
    --broadcast 2>&1) || true
echo "$EURO_OUTPUT" | grep -E "(EuroToken|Error|error)" | head -10

EURO_TOKEN_ADDRESS=$(echo "$EURO_OUTPUT" | grep -i "EuroToken deployed at:" | awk '{print $NF}' | tr -d '\r')

if [ -z "$EURO_TOKEN_ADDRESS" ]; then
    echo -e "${RED}❌ Falló el deploy de EuroToken${NC}"
    echo "$EURO_OUTPUT"
    exit 1
fi
echo -e "${GREEN}✅ EuroToken: ${EURO_TOKEN_ADDRESS}${NC}"
echo ""

# ─────────────────────────────────────────
# 2. Deploy EcommerceMain
# ─────────────────────────────────────────
echo -e "${BLUE}[2/3] Desplegando EcommerceMain...${NC}"
cd "${SCRIPT_DIR}/sc-ecommerce"

FORGE_OUT=$(forge create --rpc-url ${RPC_URL} \
    --private-key ${PRIVATE_KEY} \
    --broadcast \
    src/EcommerceMain.sol:EcommerceMain \
    --constructor-args ${EURO_TOKEN_ADDRESS} 2>&1) || true
echo "$FORGE_OUT" | grep -E "(Deployed|Error|error)" | head -5

ECOMMERCE_ADDRESS=$(echo "$FORGE_OUT" | grep "Deployed to:" | awk '{print $3}' | tr -d '\r')

if [ -z "$ECOMMERCE_ADDRESS" ]; then
    echo -e "${RED}❌ Falló el deploy de EcommerceMain${NC}"
    echo "$FORGE_OUT"
    exit 1
fi

echo -e "${GREEN}✅ EcommerceMain:  ${ECOMMERCE_ADDRESS}${NC}"
echo ""

# ─────────────────────────────────────────
# 3. Escribir archivos .env
# ─────────────────────────────────────────
echo -e "${BLUE}[3/3] Actualizando archivos .env...${NC}"

cat > "${COMPRA_ENV}" << EOF
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${STRIPE_PK}
STRIPE_SECRET_KEY=${STRIPE_SK}
STRIPE_WEBHOOK_SECRET=${STRIPE_WH}
NEXT_PUBLIC_EUROTOKEN_CONTRACT_ADDRESS=${EURO_TOKEN_ADDRESS}
WALLET_PRIVATE_KEY=${WALLET_PK}
NEXT_PUBLIC_RPC_URL=${RPC_URL}
EOF
echo -e "${GREEN}  ✅ stablecoin/compra-stableboin/.env.local${NC}"

cat > "${PASARELA_ENV}" << EOF
NEXT_PUBLIC_EUROTOKEN_ADDRESS=${EURO_TOKEN_ADDRESS}
NEXT_PUBLIC_ECOMMERCE_ADDRESS=${ECOMMERCE_ADDRESS}
NEXT_PUBLIC_PAYMENT_GATEWAY_ADDRESS=${ECOMMERCE_ADDRESS}
NEXT_PUBLIC_RPC_URL=${RPC_URL}
EOF
echo -e "${GREEN}  ✅ stablecoin/pasarela-de-pago/.env.local${NC}"

cat > "${ECOMMERCE_ENV}" << EOF
NEXT_PUBLIC_ECOMMERCE_CONTRACT_ADDRESS=${ECOMMERCE_ADDRESS}
NEXT_PUBLIC_EUROTOKEN_CONTRACT_ADDRESS=${EURO_TOKEN_ADDRESS}
NEXT_PUBLIC_RPC_URL=${RPC_URL}
EOF
echo -e "${GREEN}  ✅ sc-ecommerce/.env${NC}"

# Preservar PINATA_JWT si ya estaba configurado
PINATA_JWT=""
if [ -f "${WEB_ADMIN_ENV}" ]; then
    PINATA_JWT=$(grep "^NEXT_PUBLIC_PINATA_JWT=" "${WEB_ADMIN_ENV}" | cut -d'=' -f2-)
fi

cat > "${WEB_ADMIN_ENV}" << EOF
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=${RPC_URL}
NEXT_PUBLIC_ECOMMERCE_MAIN_ADDRESS=${ECOMMERCE_ADDRESS}
NEXT_PUBLIC_EURO_TOKEN_ADDRESS=${EURO_TOKEN_ADDRESS}
NEXT_PUBLIC_PINATA_JWT=${PINATA_JWT}
EOF
echo -e "${GREEN}  ✅ web-admin/.env.local${NC}"
echo ""

# ─────────────────────────────────────────
# Resumen final
# ─────────────────────────────────────────
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deploy completo${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  EuroToken:        ${EURO_TOKEN_ADDRESS}"
echo -e "  EcommerceMain:    ${ECOMMERCE_ADDRESS}"
echo -e "  Owner/Deployer:   ${DEPLOYER}"
echo ""
echo -e "Para iniciar las apps:"
echo -e "  cd stablecoin/compra-stableboin && npm run dev   (puerto 6001)"
echo -e "  cd stablecoin/pasarela-de-pago  && npm run dev   (puerto 6002)"
echo -e "  cd web-admin                    && npm run dev   (puerto 6003)"
