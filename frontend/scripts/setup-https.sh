#!/bin/bash

# Script para gerar certificados HTTPS auto-assinados
# Necessário para testar câmera no celular via rede local

CERTS_DIR="$(dirname "$0")/../certs"

# Cria diretório se não existir
mkdir -p "$CERTS_DIR"

# Obtém IP local
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')

# Força regeneração se passou --force ou se IP mudou
FORCE_REGEN=false
if [ "$1" = "--force" ]; then
    FORCE_REGEN=true
fi

# Verifica se certificados já existem e se o IP está correto
if [ -f "$CERTS_DIR/key.pem" ] && [ -f "$CERTS_DIR/cert.pem" ] && [ "$FORCE_REGEN" = false ]; then
    # Verifica se o certificado atual contém o IP correto
    CERT_IPS=$(openssl x509 -in "$CERTS_DIR/cert.pem" -text -noout 2>/dev/null | grep -A1 "Subject Alternative Name" | grep "IP Address")
    if echo "$CERT_IPS" | grep -q "$LOCAL_IP"; then
        echo "✅ Certificados já existem com IP correto ($LOCAL_IP)"
    else
        echo "⚠️  IP mudou, regenerando certificados..."
        FORCE_REGEN=true
    fi
fi

if [ ! -f "$CERTS_DIR/key.pem" ] || [ ! -f "$CERTS_DIR/cert.pem" ] || [ "$FORCE_REGEN" = true ]; then
    echo "🔐 Gerando certificados HTTPS para IP: $LOCAL_IP"

    # Criar arquivo de configuração temporário para incluir SAN
    CONFIG_FILE="$CERTS_DIR/openssl.cnf"
    cat > "$CONFIG_FILE" << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
CN = $LOCAL_IP

[v3_req]
basicConstraints = CA:TRUE
keyUsage = digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
IP.2 = $LOCAL_IP
EOF

    # Gera certificado válido por 365 dias com SAN
    openssl req -x509 -newkey rsa:2048 \
        -keyout "$CERTS_DIR/key.pem" \
        -out "$CERTS_DIR/cert.pem" \
        -days 365 -nodes \
        -config "$CONFIG_FILE" 2>/dev/null

    if [ $? -eq 0 ]; then
        echo "✅ Certificados gerados com sucesso!"
        # Copiar para public para download no iOS
        mkdir -p "$(dirname "$0")/../public/certs"
        cp "$CERTS_DIR/cert.pem" "$(dirname "$0")/../public/certs/"
        echo "✅ Certificado copiado para public/certs/"
        rm "$CONFIG_FILE"
    else
        echo "❌ Erro ao gerar certificados. Verifique se openssl está instalado."
        exit 1
    fi
fi

# Obtém IP local (novamente para exibir instruções)
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 TESTE NO CELULAR - INSTRUÇÕES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1️⃣  BACKEND (em outro terminal):"
echo "    cd backend && source .venv/bin/activate"
echo "    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload \\"
echo "      --ssl-keyfile ../frontend/certs/key.pem \\"
echo "      --ssl-certfile ../frontend/certs/cert.pem"
echo ""
echo "2️⃣  CELULAR:"
echo "    • Conecte na mesma rede WiFi"
echo "    • PRIMEIRO acesse: https://$LOCAL_IP:8000/health"
echo "      (aceite o certificado do backend)"
echo "    • DEPOIS acesse: https://$LOCAL_IP:3000"
echo "      (aceite o certificado do frontend)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
