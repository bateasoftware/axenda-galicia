<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Proyecto Axenda

- **Lee `docs/vision.md` antes de proponer funcionalidades**: concepto, público, fases, monetización y decisiones ya tomadas.
- Interfaz y contenido en castellano (los eventos pueden traer título en gallego, `titulo_gl`).
- Modelo de datos en `src/lib/tipos.ts` (esquema zod: de ahí salen los tipos, la validación y el formato de salida del extractor). Si cambia, revisa las reglas del prompt en `scripts/extraer.ts` y actualiza `supabase/esquema.sql`.
- Los datos se validan con `npm run validar`; un evento no válido en `data/eventos` hace fallar el build.
- Los eventos se leen solo a través de `src/lib/eventos.ts` (cuando se migre a Supabase, solo cambia ese archivo).
- Fechas como hora local de Galicia sin zona (`YYYY-MM-DDTHH:MM`). Helpers en `src/lib/fechas.ts`.
- Lo que dependa de "hoy" se calcula en el cliente (`hoyGalicia`), nunca en el render estático.
- Fuentes autoalojadas con @fontsource (no usar next/font/google).
- Antes de terminar: `npm run validar && npm run lint && npm run build`.
