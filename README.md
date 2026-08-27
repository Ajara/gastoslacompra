# La compra

Hucha de casa: foto del ticket, líneas en SQLite, y el gasto del mes en el móvil.

Backend en **Go**, base **SQLite** persistida, frontend Next.js. Ya no usa Supabase.

## Docker (pruebas en local)

En `.env.local` (copia de `.env.example`) pon `OPENAI_API_KEY`.

```bash
docker compose up --build
```

- App: http://localhost:3001
- API: http://localhost:8081/health
- SQLite y fotos: carpeta `data/` en el repo (sobrevive a `docker compose down`)

Crea cuenta en la pantalla de login (correo + contraseña). El primero crea la hucha; el segundo se une con el código.

## Sin Docker

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
