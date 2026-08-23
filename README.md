# La compra

Hucha de casa: foto del ticket al salir de la tienda, líneas guardadas, y el gasto del mes en el móvil.

## Arranque

1. Crea un proyecto en [Supabase](https://supabase.com).
2. En **SQL Editor**, ejecuta [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql).
3. En **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:3000`
   - **Redirect URLs:** `http://localhost:3000/auth/callback` (y la URL de producción cuando la tengas)
4. Por defecto el correo manda un **enlace**, no un código. En **Authentication → Email Templates → Magic Link** añade esto para que también llegue el código de 6 dígitos:

```
Tu código: {{ .Token }}
```

5. Copia variables:

```bash
cp .env.example .env.local
```

Rellena `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Settings → API).

Para leer tickets, pon **una** clave de visión: `OPENAI_API_KEY` o `ANTHROPIC_API_KEY`.

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`. Entra con el correo: abre el enlace **en el mismo navegador** o escribe el código de 6 dígitos. El primero crea la hucha; el segundo se une con el código de 6 letras.

En el móvil: misma URL, **Añadir a pantalla de inicio**. El botón **Foto** abre la cámara.

## Uso

- **Foto** — captura, revisión, guardar si las líneas cuadran con el total.
- **Inicio** — mes vs anterior, por tienda, lo que se repite, últimos tickets.
- **Producto** — veces, gasto, precio en el tiempo.
- En una hucha vacía puedes **cargar el ejemplo** (DIA 2,69 € y Mercadona 76,12 €).
