# Axenda

Agenda de eventos de Val Miñor y Vigo (y, más adelante, de toda Galicia). Es una PWA que convierte los carteles que la gente comparte por WhatsApp en eventos ordenados en **lista, mapa y calendario**, con páginas preparadas para SEO.

> "Axenda" es un nombre provisional. Se cambia en `src/lib/sitio.ts`.

## Stack

- **Next.js 16** (App Router, Cache Components) + **Tailwind 4**: páginas estáticas, rápidas y baratas en Vercel.
- **Leaflet + OpenStreetMap**: mapa sin coste ni API key.
- **Claude API**: extracción de datos de los carteles.
- **Datos (fase 1)**: un JSON por evento en `data/eventos/`, con git como CMS. Cada push a `main` despliega.
- **Datos (fase 2)**: Supabase + PostGIS. El esquema está en `supabase/esquema.sql`; basta con sustituir `src/lib/eventos.ts`.

## Flujo para publicar eventos

```bash
cp .env.example .env.local        # y pon tu ANTHROPIC_API_KEY
# 1. Copia los carteles (tal cual vienen de WhatsApp) a data/entrada/
npm run extraer                   # 2. La IA genera data/pendientes/<slug>.json
# 3. Revisa cada JSON: "inferido", "confianza" y las coordenadas ("aprox")
npm run publicar                  # 4. Pasa a data/eventos/ y copia el cartel a public/carteles/
git add -A && git commit -m "Eventos" && git push   # 5. Vercel lo publica
```

La fecha de recepción se saca del nombre del archivo de WhatsApp (`…PHOTO-2026-11-19-09-52-44.jpg`) para deducir el año cuando el cartel no lo dice.

`data/lugares.json` es la tabla de concellos, parroquias y sitios conocidos con sus coordenadas. Cuanto más completa esté, mejor saldrá el mapa. Las coordenadas actuales son **aproximadas**.

## Qué incluye

| Ruta | Qué es |
|---|---|
| `/` | Agenda con filtros (próximos, este finde, concello, categoría) y vistas de lista, mapa y calendario |
| `/evento/[slug]` | Ficha con cartel, datos estructurados `schema.org/Event` (para el buscador de eventos de Google), botón de añadir al calendario (.ics) y cómo llegar |
| `/concello/[concello]` | Página SEO "Qué hacer en X" |
| `/enviar` | Explicación para que los organizadores manden su cartel |
| `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest` | SEO y PWA instalable, con un service worker básico sin conexión |

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
```

## Próximos pasos

1. Dominio propio y `NEXT_PUBLIC_SITE_URL`.
2. Número de WhatsApp Business (Cloud API) → webhook → extracción automática → cola de revisión.
3. Panel de revisión (aprobar o editar) y paso a Supabase.
4. Newsletter "Plan de finde" y destacados de pago en autoservicio.
5. Corregir las coordenadas en `data/lugares.json` y ampliarlo comarca a comarca.
