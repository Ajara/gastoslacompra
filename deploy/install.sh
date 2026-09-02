#!/usr/bin/env bash
# Instala La compra en la VM: binario Go + Next + systemd.
# No usa Docker. Nginx se configura aparte (deploy/nginx-lacompra.conf).
#
#   sudo git clone https://github.com/Ajara/gastoslacompra.git /opt/lacompra
#   sudo /opt/lacompra/deploy/install.sh
#
# Si Go/Node están en el PATH del usuario (no de root):
#   sudo env "PATH=$PATH" /opt/lacompra/deploy/install.sh
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

# sudo recorta el PATH: Go suele estar en /usr/local/go/bin, Node en nvm del usuario.
USER_HOME=""
if [[ -n "${SUDO_USER:-}" ]]; then
  USER_HOME="$(getent passwd "$SUDO_USER" | cut -d: -f6)"
  [[ -n "$USER_HOME" ]] || USER_HOME="/home/${SUDO_USER}"
fi
PATH="/usr/local/go/bin:/usr/lib/go/bin:/usr/lib/golang/bin:/snap/bin:/usr/local/bin:${PATH}"
if [[ -n "$USER_HOME" ]]; then
  PATH="${USER_HOME}/go/bin:${USER_HOME}/sdk/go/bin:${USER_HOME}/.local/bin:${PATH}"
  if [[ -d "${USER_HOME}/.nvm/versions/node" ]]; then
    for d in "${USER_HOME}/.nvm/versions/node"/v*/bin; do
      PATH="${d}:${PATH}"
    done
  fi
fi
export PATH

resolve() {
  local name="$1" found=""
  found="$(command -v "$name" 2>/dev/null || true)"
  if [[ -z "$found" && -n "${SUDO_USER:-}" ]]; then
    found="$(su - "$SUDO_USER" -c "command -v ${name}" 2>/dev/null || true)"
  fi
  if [[ -z "$found" || ! -x "$found" ]]; then
    echo "Falta ${name}. sudo no usa el PATH de tu usuario." >&2
    echo "Como tu usuario: which ${name}" >&2
    echo "Luego: sudo env \"PATH=\$PATH\" ${PREFIX}/deploy/install.sh" >&2
    exit 1
  fi
  printf '%s\n' "$found"
}

GO_BIN="$(resolve go)"
NODE_BIN="$(resolve node)"
NPM_BIN="$(resolve npm)"

id -u lacompra >/dev/null 2>&1 || useradd --system --home "${PREFIX}" --shell /usr/sbin/nologin lacompra

if [[ ! -f "${PREFIX}/.env" ]]; then
  cp "${PREFIX}/deploy/env.example" "${PREFIX}/.env"
  echo "Edita ${PREFIX}/.env (OPENAI_API_KEY) y vuelve a ejecutar este script." >&2
  exit 1
fi

mkdir -p "${PREFIX}/data" "${PREFIX}/backend/bin"

echo "Compilando API con ${GO_BIN}…"
(cd "${PREFIX}/backend" && CGO_ENABLED=0 "$GO_BIN" build -o bin/server ./cmd/server)

echo "Instalando y compilando web con ${NODE_BIN}…"
(cd "${PREFIX}" && "$NPM_BIN" ci && "$NPM_BIN" run build)

sed "s|/usr/bin/node|${NODE_BIN}|" "${PREFIX}/deploy/lacompra-web.service" >/etc/systemd/system/lacompra-web.service
cp "${PREFIX}/deploy/lacompra-api.service" /etc/systemd/system/lacompra-api.service

chown -R lacompra:lacompra "${PREFIX}"

if command -v restorecon >/dev/null 2>&1; then
  echo "Restaurando contexto SELinux…"
  restorecon -Rv "${PREFIX}" \
    /etc/systemd/system/lacompra-api.service \
    /etc/systemd/system/lacompra-web.service
fi

systemctl daemon-reload
systemctl enable --now lacompra-api.service lacompra-web.service
systemctl restart lacompra-api.service lacompra-web.service

echo
echo "API: 127.0.0.1:8082  web: 127.0.0.1:3001"
echo "Siguiente: copiar deploy/nginx-lacompra.conf y certbot."
systemctl --no-pager --full status lacompra-api.service lacompra-web.service || true
