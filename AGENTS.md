<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Proyecto Axenda

- **Lee `docs/vision.md` antes de proponer funcionalidades**: concepto, público, fases, monetización y decisiones ya tomadas.
- Interfaz y contenido en castellano (los eventos pueden traer título en gallego, `titulo_gl`).
- Modelo de datos en `src/lib/tipos.ts` (esquema zod: de ahí salen los tipos, la validación y el formato de salida del extractor). Si cambia, revisa las reglas del prompt en `scripts/extraer.ts` y actualiza `supabase/esquema.sql`.
- Entrada de eventos: `src/lib/entrada.ts` (cartel, PDF o texto → `extraccion.ts` → pendientes). Canales: `/api/entrada` (Gmail), `/api/whatsapp`, el formulario de `/enviar`, `npm run extraer` y `npm run importar` (fuentes de `data/fuentes.json`). Todo entra como pendiente y una persona publica desde `/admin`. Los datos de quien envía nunca van al evento: el contacto se guarda aparte (tabla `contactos` en Turso/Supabase, `data/pendientes/.privado/` en local) y se borra al avisarle.
- Almacén de pendientes: `src/lib/almacen/`, todos con la misma interfaz `Almacen`: Turso (`TURSO_DATABASE_URL`; carteles en su tabla `carteles`, servidos en `/cartel/<id>`, o en Vercel Blob si hay `BLOB_READ_WRITE_TOKEN`), Supabase (`SUPABASE_URL`) o ficheros locales. Esquemas en `turso/esquema.sql` y `supabase/esquema.sql` (el evento entero va en `datos` como JSON). Si cambias el modelo, revisa los dos. Migración: `npm run migrar-a-supabase`.
- Fuentes: `docs/fuentes.md`. Nada de extracción automática de Instagram/Facebook; prensa y agregadores solo como alerta; respeta robots.txt y guarda la atribución que pida la licencia.
- Lo que depende de Juan (cuentas, claves, decisiones) va en `docs/pendientes-juan.md`: mantenlo al día.
- Los datos se validan con `npm run validar`; un evento no válido en `data/eventos` hace fallar el build.
- Los eventos publicados se leen solo a través de `src/lib/eventos.ts` (JSON de `data/eventos` + la base de datos en la nube, con `use cache` y la etiqueta `eventos`; al publicar se invalida).
- Fechas como hora local de Galicia sin zona (`YYYY-MM-DDTHH:MM`). Helpers en `src/lib/fechas.ts`.
- Lo que dependa de "hoy" se calcula en el cliente (`hoyGalicia`), nunca en el render estático.
- Fuentes autoalojadas con @fontsource (no usar next/font/google).
- Tests en `tests/` con `node:test` (`npm test`). Si tocas `src/lib/fechas.ts` o `src/lib/validacion.ts`, añade o ajusta sus tests.
- Antes de terminar: `npm run validar && npm test && npm run lint && npm run build` (lo mismo que ejecuta la CI en GitHub).

## Extraer carteles sin la API (con Claude Code)

Si no hay `ANTHROPIC_API_KEY` (la API es de pago), la extracción la hace el agente cuando se lo piden ("extrae los carteles de data/entrada"):

1. Por cada imagen o PDF de `data/entrada/`, lee el archivo y aplica las reglas de `prompt()` en `src/lib/extraccion.ts`:
   - un evento por acto en los programas;
   - resumen propio;
   - lo deducido en `inferido`;
   - coordenadas de `data/lugares.json`.
2. Escribe un pendiente por evento en `data/pendientes/<slug>.json`, con el formato de `EventoBase` en `src/lib/tipos.ts`:
   - `fuente.canal`: `"whatsapp"` para fotos de WhatsApp, `"programa-pdf"` para PDF y `"manual"` para el resto;
   - `fuente.recibido`: sale del nombre del archivo de WhatsApp o de la fecha de modificación.
3. Si es una imagen:
   - cópiala reducida a `data/pendientes/carteles/<slug>.jpg` con `npx tsx -e` y `normalizarCartel` de `src/lib/imagen.ts`;
   - añade `"_cartel": "data/pendientes/carteles/<slug>.jpg"` al JSON.
4. Mueve los originales a `data/entrada/procesadas/` y ejecuta `npm run validar`.
5. Dile a Juan que ejecute `npm run subir-pendientes` (los sube a Turso) y los revise en `/admin`. Sin Turso, se revisan en local con `npm run dev`.
