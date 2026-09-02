#!/usr/bin/env bash
# Instala La compra en la VM: binario Go + Next + systemd.
# No usa Docker. Nginx se configura aparte (deploy/nginx-lacompra.conf).
#
#   sudo git clone https://github.com/Ajara/gastoslacompra.git /opt/lacompra
#   sudo /opt/lacompra/deploy/install.sh
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Ejecuta con sudo." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PREFIX="${PREFIX:-/opt/lacompra}"

if [[ "${ROOT}" != "${PREFIX}" ]]; then
  echo "El repo debe estar en ${PREFIX} (ahora está en ${ROOT})." >&2
  echo "Clona ahí o llama: PREFIX=${ROOT} $0" >&2
  exit 1
fi

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Falta $1. Instálalo y vuelve a ejecutar." >&2
    exit 1
  }
}

need go
need node
need npm

id -u lacompra >/dev/null 2>&1 || useradd --system --home "${PREFIX}" --shell /usr/sbin/nologin lacompra

if [[ ! -f "${PREFIX}/.env" ]]; then
  cp "${PREFIX}/deploy/env.example" "${PREFIX}/.env"
  echo "Edita ${PREFIX}/.env (OPENAI_API_KEY) y vuelve a ejecutar este script." >&2
  exit 1
fi

mkdir -p "${PREFIX}/data" "${PREFIX}/backend/bin"

echo "Compilando API…"
(cd "${PREFIX}/backend" && CGO_ENABLED=0 go build -o bin/server ./cmd/server)

echo "Instalando y compilando web…"
(cd "${PREFIX}" && npm ci && npm run build)

NODE_BIN="$(command -v node)"
sed "s|/usr/bin/node|${NODE_BIN}|" "${PREFIX}/deploy/lacompra-web.service" >/etc/systemd/system/lacompra-web.service
cp "${PREFIX}/deploy/lacompra-api.service" /etc/systemd/system/lacompra-api.service

chown -R lacompra:lacompra "${PREFIX}"

systemctl daemon-reload
systemctl enable --now lacompra-api.service lacompra-web.service
systemctl restart lacompra-api.service lacompra-web.service

echo
echo "API: 127.0.0.1:8082  web: 127.0.0.1:3001"
echo "Siguiente: copiar deploy/nginx-lacompra.conf y certbot."
systemctl --no-pager --full status lacompra-api.service lacompra-web.service || true
