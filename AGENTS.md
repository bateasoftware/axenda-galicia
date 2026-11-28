<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Proyecto altofalante (antes «Axenda»)

- **Lee `docs/vision.md` antes de proponer funcionalidades**: concepto, público, fases, monetización y decisiones ya tomadas.
- Interfaz y contenido en castellano (los eventos pueden traer título en gallego, `titulo_gl`).
- Modelo de datos en `src/lib/tipos.ts` (esquema zod: de ahí salen los tipos, la validación y el formato de salida del extractor). Si cambia, revisa las reglas del prompt en `scripts/extraer.ts` y actualiza `supabase/esquema.sql`.
- Entrada de eventos: `src/lib/entrada.ts` (cartel, PDF o texto → `extraccion.ts` → pendientes). Canales: `/api/entrada` (Gmail), `/api/whatsapp`, el formulario de `/enviar`, `npm run extraer` y `npm run importar` (fuentes de `data/fuentes.json`). Todo entra como pendiente y una persona publica desde `/admin`. Los datos de quien envía nunca van al evento: el contacto se guarda aparte (tabla `contactos` en Turso/Supabase, `data/pendientes/.privado/` en local) y se borra al avisarle.
- Almacén de pendientes: `src/lib/almacen/`, todos con la misma interfaz `Almacen`: Turso (`TURSO_DATABASE_URL`; carteles en su tabla `carteles`, servidos en `/cartel/<id>`, o en Vercel Blob si hay `BLOB_READ_WRITE_TOKEN`), Supabase (`SUPABASE_URL`) o ficheros locales. Esquemas en `turso/esquema.sql` y `supabase/esquema.sql` (el evento entero va en `datos` como JSON). Si cambias el modelo, revisa los dos. Migración: `npm run migrar-a-supabase`.
- Fuentes: `docs/fuentes.md`. Nada de extracción automática de Instagram/Facebook; prensa y agregadores solo como alerta; respeta robots.txt y guarda la atribución que pida la licencia.
- Lo que depende de Juan (cuentas, claves, decisiones) va en `docs/pendientes-juan.md`: mantenlo al día.
- Panel de revisión (`/admin`): la cola y el editor comparten `src/lib/admin/cola.ts` (filtros, orden, anterior/siguiente); en pantallas grandes `/admin/[id]` enseña la cola a la izquierda y el cartel fijo a la derecha, con atajos (Ctrl/⌘+Intro publica, Ctrl/⌘+S guarda, Alt+↑/↓ cambia de pendiente). Para validar lo que llega sin cartel (Cultura de Galicia, Vigo), `src/lib/admin/origen.ts` da el enlace a la página original (los de datos.vigo.org se reconstruyen con su id en hoxe.vigo.org) y búsquedas ya rellenadas (Google y la web del concello); la cola filtra «sin enlace», «sin imagen» y «sin hora». Los pendientes con fecha ya pasada (`esPasado` en `cola.ts`) se descartan con el botón de la lista o solos a diario con `npm run descartar-pasados` (paso del workflow `importar.yml`). Publicación rápida opcional por emisor con historial limpio: `data/reglas.json` y `docs/reglas-confianza.md`. Lugares habituales: en la base de datos (método `lugares()` del `Almacen`, tabla `lugares`; la primera vez se rellena con `data/lugares.json`, que en local es el almacén), editables con mapa en `/admin/lugares` (al guardar, `src/lib/lugares-propagar.ts` actualiza los eventos publicados y pendientes que lo usan); el formulario del evento los autocompleta y acepta coordenadas en formato Google Maps (`src/lib/coordenadas.ts`). Nombres parecidos (`src/lib/lugares-parecidos.ts`, gallego/castellano y abreviaturas): se sugieren en el formulario y se unifican en `/admin/lugares`, nunca solos. `npm run lugares` lista los sitios publicados que faltan.
- Exposiciones y eventos largos (`src/lib/larga-duracion.ts`: una sesión de 7 días o más, o `larga_duracion` fijado en el panel): en la agenda solo salen el día que abren y en su última semana; el resto, en el bloque plegable «En curso» del `Explorador` y en `/exposiciones`. En el calendario solo marcan apertura y cierre.
- Los datos se validan con `npm run validar`; un evento no válido en `data/eventos` hace fallar el build.
- Los eventos publicados se leen solo a través de `src/lib/eventos.ts` (JSON de `data/eventos` + la base de datos en la nube, con `use cache` y la etiqueta `eventos`; al publicar se invalida).
- Fechas como hora local de Galicia sin zona (`YYYY-MM-DDTHH:MM`). Helpers en `src/lib/fechas.ts`.
- Lo que dependa de "hoy" se calcula en el cliente (`hoyGalicia`), nunca en el render estático.
- Fuentes autoalojadas con @fontsource (no usar next/font/google).
- Estadísticas: sin cookies ni datos personales (no metas Google Analytics, ni guardes IP o identificadores). Métricas propias en `src/lib/metricas/` (contadores por día en la tabla `metricas`, vía `/api/m` con `sendBeacon`); informes en `/admin/estadisticas`, `/informe/<organizador>/<token>` y `/anunciate`. Vercel Analytics y Speed Insights en `src/components/Analitica.tsx`.
- Marca altofalante («a "o" que fala»; concepto en `marca/altofalante-concepto.png`): colores y SVG del símbolo, icono de app y marcador del mapa en `src/lib/marca.ts`; `<Logotipo>` y `<Simbolo>` en `src/components/Marca.tsx` (el logotipo es texto en Space Grotesk seminegrita con la «o» como símbolo, no una imagen). `npm run logos` regenera favicon e iconos de iOS/PWA y `marca/*.svg`; no los edites a mano. Nombre y lema en `src/lib/sitio.ts`. Los identificadores internos (cookies `axenda_*`, UID de calendario `@axenda`) se mantienen a propósito.
- Tests en `tests/` con `node:test` (`npm test`). Si tocas `src/lib/fechas.ts` o `src/lib/validacion.ts`, añade o ajusta sus tests.
- Antes de terminar: `npm run validar && npm test && npm run lint && npm run build` (lo mismo que ejecuta la CI en GitHub).

## Extraer carteles sin la API (con Claude Code)

Si no hay `ANTHROPIC_API_KEY` (la API es de pago), la extracción la hace el agente cuando se lo piden (p. ej. «procesa estos carteles de WhatsApp» o «revisa las fuentes de hoy»). La guía completa está en `docs/procesar-envios.md`; resumen:

1. Lee el cartel, el PDF o el enlace y aplica las reglas de `prompt()` en `src/lib/extraccion.ts`.
2. Escribe un JSON mínimo (fuera del proyecto, en la carpeta temporal) y ejecuta `npm run anadir-pendiente -- evento.json --imagen cartel.jpg --canal whatsapp`. Valida, calcula slug y coordenadas, deduplica y guarda como pendiente en Turso.
3. Nunca publicas: Juan revisa en `/admin`. No guardes datos de quien envía.
4. Para cargar muchas imágenes sueltas con el formato antiguo (`data/entrada` → `data/pendientes`), queda `npm run subir-pendientes`.
