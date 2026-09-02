# La compra

Hucha de casa: foto del ticket, líneas en SQLite, y el gasto del mes en el móvil.

Backend en **Go**, base **SQLite** persistida, frontend Next.js. Ya no usa Supabase.

## Oracle OCI (VM con nginx y otra app)

Sin Docker. En la VM: binario Go + Next con **systemd**, nginx en un **subdominio**. Escuchan solo en localhost (`8082` y `3001`) para no pisar la otra app. No abras esos puertos en el security list.

```bash
sudo git clone https://github.com/Ajara/gastoslacompra.git /opt/lacompra
sudo cp /opt/lacompra/deploy/env.example /opt/lacompra/.env
sudo nano /opt/lacompra/.env   # OPENAI_API_KEY
sudo /opt/lacompra/deploy/install.sh
```

Hace falta Go y Node 22 en la VM. Nginx (sin tocar el vhost de la otra app), en Ubuntu/Debian:

```bash
sudo cp /opt/lacompra/deploy/nginx-lacompra.conf /etc/nginx/sites-available/lacompra
sudo nano /etc/nginx/sites-available/lacompra   # server_name
sudo ln -s /etc/nginx/sites-available/lacompra /etc/nginx/sites-enabled/lacompra
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d compra.TU_DOMINIO
```

En Oracle Linux / RHEL el archivo va a `/etc/nginx/conf.d/lacompra.conf`.

DNS: un A del subdominio a la IP de la VM. SQLite y fotos en `/opt/lacompra/data`. El repo es privado: deploy key o PAT para el clone.

Para actualizar: `git pull` en `/opt/lacompra` y otra vez `sudo ./deploy/install.sh`.

## Docker (pruebas en local)

En `.env.local` (copia de `.env.example`) pon `OPENAI_API_KEY`.

```bash
docker compose up --build
```

- App: http://localhost:3001
- API: http://localhost:8081/health
- SQLite y fotos: carpeta `data/` en el repo (sobrevive a `docker compose down`)

Crea cuenta en la pantalla de login (correo + contraseña). El primero crea la hucha; el segundo se une con el código.

## Sin Docker (desarrollo)

Terminal 1:

```bash
cd backend
go run ./cmd/server
```

Terminal 2:

```bash
cp .env.example .env.local
# API_INTERNAL_URL=http://127.0.0.1:8080
# OPENAI_API_KEY=...
npm install
npm run dev
```

## Uso

- **Foto** — captura, revisión, guardar si las líneas cuadran con el total.
- **Inicio** — mes vs anterior, por tienda, lo que se repite, últimos tickets.
- **Producto** — veces, gasto, precio en el tiempo.
