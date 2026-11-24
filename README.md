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
npm run extraer                   # 2. La IA genera data/pendientes/<slug>.json (salta las imágenes ya extraídas)
# 3. Revisa cada JSON: "inferido", "confianza" y las coordenadas ("aprox")
npm run validar                   #    Comprueba eventos, pendientes y lugares.json
npm run publicar                  # 4. Valida, pasa a data/eventos/ y copia el cartel a public/carteles/
git add -A && git commit -m "Eventos" && git push   # 5. Vercel lo publica
```

`publicar` no mueve nada que no pase la validación (fechas, categorías, coordenadas dentro de Galicia, slug único…) y solo borra la imagen de `data/entrada/` cuando el evento ya está escrito. El modelo de datos y sus reglas están en `src/lib/tipos.ts`.

La fecha de recepción se saca del nombre del archivo de WhatsApp (`…PHOTO-2026-11-19-09-52-44.jpg`) para deducir el año cuando el cartel no lo dice.

`data/lugares.json` es la tabla de concellos, parroquias y sitios conocidos con sus coordenadas. Cuanto más completa esté, mejor saldrá el mapa. Las coordenadas actuales son **aproximadas**.

## Qué incluye

| Ruta | Qué es |
|---|---|
| `/` | Agenda con filtros (próximos, este finde, concello, categoría) y vistas de lista, mapa y calendario. Los filtros van en la URL (`?vista=mapa&cuando=finde&concello=baiona&cat=infantil`) para poder compartirlos |
| `/evento/[slug]` | Ficha con cartel, datos estructurados `schema.org/Event` (para el buscador de eventos de Google), botón de añadir al calendario (`/evento/[slug]/calendario.ics`) y cómo llegar |
| `/concello/[concello]` | Página SEO "Qué hacer en X", con su propia imagen para compartir |
| `/enviar` | Explicación para que los organizadores manden su cartel |
| `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest` | SEO y PWA instalable. El service worker guarda las páginas visitadas para verlas sin conexión y sirve desde caché los ficheros estáticos y los carteles |

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
