# Axenda

Agenda de eventos de Val Miñor y Vigo (y, más adelante, de toda Galicia). Es una PWA que convierte los carteles que la gente comparte por WhatsApp en eventos ordenados en **lista, mapa y calendario**, con páginas preparadas para SEO.

> "Axenda" es un nombre provisional. Se cambia en `src/lib/sitio.ts`.

## Stack

- **Next.js 16** (App Router, Cache Components) + **Tailwind 4**: páginas estáticas, rápidas y baratas en Vercel.
- **Leaflet + OpenStreetMap**: mapa sin coste ni API key.
- **Claude API**: extracción de datos de los carteles.
- **Datos (fase 1)**: un JSON por evento en `data/eventos/`, con git como CMS. Cada push a `main` despliega.
- **Datos (fase 2)**: Supabase + PostGIS. El esquema está en `supabase/esquema.sql`; basta con sustituir `src/lib/eventos.ts`.

## Cómo entran los eventos

Todo entra como **pendiente** y una persona lo publica desde el panel `/admin`. Nada se publica solo.

| Canal | Cómo | Dónde se configura |
|---|---|---|
| WhatsApp Business | El organizador reenvía el cartel; responde "Recibido" y le avisa al publicar | `/api/whatsapp`, `docs/pendientes-juan.md` (bloque 5) |
| Formulario web | `/enviar`: cartel o PDF y datos opcionales | `/api/enviar` |
| Email | Gmail + Apps Script → `/api/entrada` | `docs/entrada-automatica.md` |
| Fuentes automáticas | Calendarios ICS, datos abiertos y boletines en PDF de `data/fuentes.json` | `npm run importar` (a diario con GitHub Actions) |
| A mano | Carteles y programas en `data/entrada/` | `npm run extraer` |

Un cartel da un evento y un programa (Navidad, fiestas, boletín) da uno por acto. Lo repetido se detecta: mismo archivo, mismo evento de la misma fuente, o mismo día, concello y título parecido. La estrategia de fuentes está en [`docs/fuentes.md`](docs/fuentes.md) y lo que falta configurar en [`docs/pendientes-juan.md`](docs/pendientes-juan.md).

**Dónde se guardan:** con Supabase (`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; esquema en `supabase/esquema.sql`), pendientes, publicados y carteles van a Supabase. Sin él, en local se usan `data/pendientes/` y `data/eventos/`, con git como CMS. La web lee siempre los JSON de `data/eventos/` y, si está configurado, lo publicado en Supabase.

## Flujo en local

```bash
cp .env.example .env.local        # ANTHROPIC_API_KEY y ADMIN_CLAVE
# Carteles o PDF en data/entrada/
npm run extraer                   # → data/pendientes/ (un pendiente por evento)
npm run importar                  # fuentes automáticas → data/pendientes/
npm run dev                       # revisa y publica en http://localhost:3000/admin
git add -A && git commit -m "Eventos" && git push   # Vercel lo publica
```

Otros comandos:

- `npm run publicar`: publica desde la terminal los pendientes válidos.
- `npm run revisar-fuentes`: dice qué fuentes toca revisar a mano hoy.
- `npm run duplicados`: lista los posibles duplicados.

La fecha de recepción se saca del nombre del archivo de WhatsApp (`…PHOTO-2026-11-19-09-52-44.jpg`) para deducir el año cuando el cartel no lo dice.

`data/lugares.json` es la tabla de concellos, parroquias y sitios conocidos con sus coordenadas. Cuanto más completa esté, mejor saldrá el mapa. Las coordenadas actuales son **aproximadas**.

## Qué incluye

| Ruta | Qué es |
|---|---|
| `/` | Agenda con filtros (próximos, este finde, concello, categoría) y vistas de lista, mapa y calendario. Los filtros van en la URL (`?vista=mapa&cuando=finde&concello=baiona&cat=infantil`) para poder compartirlos |
| `/evento/[slug]` | Ficha con cartel, datos estructurados `schema.org/Event` (para el buscador de eventos de Google), botón de añadir al calendario (`/evento/[slug]/calendario.ics`) y cómo llegar |
| `/concello/[concello]` | Página SEO "Qué hacer en X", con su propia imagen para compartir |
| `/enviar` | Formulario para mandar un cartel o programa, WhatsApp y email |
| `/organizador/[slug]` | Todos los eventos de un organizador |
| `/widget` | Widget "Agenda de la zona" para insertar en otras webs (`/widget.js`, `/widget/agenda`) |
| `/admin` | Panel de revisión (contraseña `ADMIN_CLAVE`): pendientes, publicar o descartar y `/admin/cobertura` |
| `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest` | SEO y PWA instalable. El service worker guarda las páginas visitadas para verlas sin conexión y sirve desde caché los ficheros estáticos y los carteles |

## Desarrollo

```bash
npm install
npm run dev       # http://localhost:3000
npm run validar   # datos de data/
npm test          # tests de fechas, .ics y validación (node:test)
npm run lint
npm run build
```

Cada push a `main` y cada pull request pasan por la GitHub Action de `.github/workflows/ci.yml` (validar, tests, lint y build). Si falla, no te fíes del despliegue de Vercel: corrige antes.

## Próximos pasos

Lo que depende de configurar cuentas está en `docs/pendientes-juan.md`. Además:

1. Dominio propio y `NEXT_PUBLIC_SITE_URL`.
2. Política de privacidad y aviso legal (los pide Meta para WhatsApp).
3. Newsletter "Plan de finde" y destacados de pago en autoservicio.
4. Corregir las coordenadas en `data/lugares.json` y ampliarlo comarca a comarca.
