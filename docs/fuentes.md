# Fuentes de eventos

Cómo conseguir eventos de forma recurrente más allá del grupo de WhatsApp. El registro vivo está en [`data/fuentes.json`](../data/fuentes.json); este documento explica la estrategia y las reglas.

## Principios

1. **Lo mejor es que nos lo manden** (envío directo): el organizador da su consentimiento, el cartel es suyo y la información es la buena. Todo lo demás sirve para descubrir eventos y para convencer a los organizadores de que nos escriban.
2. **Automatizar solo lo que es abierto**: calendarios ICS, APIs y datos abiertos con licencia que permite reutilizar. Respetamos `robots.txt` y guardamos la atribución que pida la licencia.
3. **Nada se publica solo**: todo lo importado entra como pendiente y una persona lo revisa en `/admin`.
4. **Resumen siempre propio**: nunca copiamos el texto de la fuente.

## Niveles de fuentes

| Nivel | Qué | Método | Ejemplos |
|---|---|---|---|
| 1. Oficiales automatizables | Calendarios y datos abiertos | `ics`, `api`, `pdf` con `npm run importar` | Cultura de Galicia (iCal), datos.vigo.org, boletín Axenda Saudable del SERGAS |
| 2. Concellos e instituciones | Webs municipales, bibliotecas, auditorios, cines, turismo | `revision-manual` con `npm run revisar-fuentes` | nigran.es, baiona.gal, concellodegondomar.gal |
| 3. Tejido asociativo | Asociaciones, ANPAs, clubes, comercios | `envio-directo`: contactarlos para que manden el cartel | Directorio de asociaciones de Gondomar |
| 4. Prensa y agregadores | Faro de Vigo, Atlántico, Metropolitano, Páxinas Galegas, Treintayseis | `revision-manual`, **solo como alerta** | — |
| 5. Redes sociales | Instagram y Facebook de concellos y asociaciones | `revision-manual`, **sin extracción automática** | — |

### 1. Fuentes automatizables (comprobado el 2026-11-24)

- **Agenda de Cultura de Galicia** (la misma que muestra turismo.gal). Tiene un iCal público en `https://www.cultura.gal/gl/ical`, con unos 110 eventos de toda Galicia, y un RSS en `/gl/rssaxenda`. El importador `ics` se queda con los de Baiona, Nigrán, Gondomar y Vigo según `LOCATION`. Ya incluye el Auditorio Municipal de Nigrán y la Biblioteca Pública de Vigo.
  - **Licencia:** el aviso legal permite reutilizar citando la fuente y sin desnaturalizar el contenido. Guardamos "Fuente: Cultura de Galicia (Xunta de Galicia), cultura.gal" y el enlace original en cada evento.
  - **robots.txt:** pide `Crawl-delay: 10`, así que basta una descarga al día.
  - **No usar turismo.gal:** su robots.txt prohíbe `/axenda-cultural/`.
- **Agenda cultural del Concello de Vigo** (datos.vigo.org, dataset `agenda-cultura` del catálogo CKAN `datos-ckan.vigo.org`). Es un JSON en `https://datos.vigo.org/data/axenda/agenda-hoy.json` con licencia **ODC-BY**: hay que atribuir.
  - **Limitación:** solo trae lo que está en curso **hoy**, sin hora. Detecta los eventos tarde, el mismo día que empiezan, y sirve sobre todo para exposiciones y programas largos.
  - El importador `vigo-agenda` ignora los permanentes (museos, rutas) y marca la hora como deducida.
  - No hay feed de eventos futuros. El resto del catálogo de Vigo (avisos, noticias, RSS de Turismo de Vigo) son noticias, no eventos.
- **Axenda Saudable del Área Sanitaria de Vigo** (SERGAS). Es un PDF mensual con paseos, charlas y talleres por concello.
  - **URL:** `…/PDFS_ACTIVIDADES/{MES}_{AÑO}_BOLETIN_ACTIVIDADES_MENSUAL_Vigo.pdf`. El importador `pdf-mensual` descarga el del mes en curso y la IA saca un pendiente por actividad.
  - **Aviso:** el 2026-11-24 el último disponible era el de junio de 2026 (`XUNO_2026`); los de octubre y noviembre daban 404. Si cambian el nombre, actualiza `url_datos`.

Lo que **no** existe (comprobado): no hay conjunto de datos de agenda en abertos.xunta.gal, ni API de eventos en las webs de Baiona, Nigrán o Gondomar. Son WordPress sin calendario de eventos: publican las convocatorias como noticias, con RSS.

### 2. Concellos e instituciones

Se revisan a mano con la frecuencia de `fuentes.json`. Las webs municipales publican las convocatorias como noticias y los programas grandes (Nadal, fiestas, Folla informativa de Nigrán) en PDF. **Los PDF se cargan con `npm run extraer`**, que crea un pendiente por acto (ver "Programas en PDF" más abajo).

### 3. Tejido asociativo (la fuente que más vale)

El objetivo es que cada organizador mande sus carteles sin que se lo pidamos. Para eso:

- Formulario en `/enviar`, email y, cuando exista, el número de WhatsApp.
- Al publicar, el panel genera el mensaje "Tu evento ya está en altofalante: <enlace>" para devolvérselo al organizador. Si vino por WhatsApp, se le manda solo.
- Página pública `/organizador/<slug>` con todos sus eventos, para que la compartan.
- Widget "Agenda de la zona" (`/widget`) para webs de concellos, hoteles y asociaciones.

Guion de contacto (email o WhatsApp a asociaciones y ANPAs):

> Hola, somos altofalante, una agenda gratuita de eventos de Val Miñor y Vigo. Si nos reenviáis el cartel de vuestras actividades a [email / WhatsApp], lo publicamos gratis en la agenda, en el mapa y en el calendario, con enlace a vuestra página. Así es como queda: [enlace a /organizador/…].

### 4. Prensa y agregadores: solo alerta

Sirven para **enterarse** de que hay un evento. No se copia su texto ni sus imágenes. Se busca la fuente original (web del concello, cartel del organizador) o se pide al organizador que lo mande. El resumen siempre es propio.

### 5. Redes sociales: solo revisión manual

**Nada de extracción automática de Instagram ni de Facebook**: va contra sus condiciones. Si un cartel interesa, se pide al organizador que lo mande o se carga a mano (`npm run extraer`) con resumen propio y su permiso. Ver "Derechos sobre los carteles" en `docs/vision.md`.

## Cómo se revisan las fuentes manuales

`revision-manual` significa que la fuente no ofrece calendario ni feed que podamos importar. La revisión la hace la sesión de procesado de envíos (ver `docs/procesar-envios.md`):

1. `npm run revisar-fuentes` dice qué toca hoy.
2. La sesión abre cada página (respetando `robots.txt`), detecta los eventos nuevos y los añade como pendientes con `npm run anadir-pendiente`, con resumen propio, la URL de origen y `--canal manual`.
3. Marca la fuente como revisada: `npm run revisar-fuentes -- --marcar <id>`.

Para prensa y agregadores sirve igual, solo como alerta: se busca la fuente original o el cartel y no se copia ningún texto. Instagram y Facebook quedan fuera.

## Duplicados

El mismo evento suele llegar por varias vías: el cartel del organizador, la web del concello, Cultura de Galicia… Al llegar, cada evento se compara con los pendientes y los publicados (mismo día, mismo concello y título parecido; `src/lib/duplicados.ts`):

- **Casi idéntico** (parecido ≥ 85 %) y viene de un importador automático: no se crea otro.
- **Parecido** (≥ 50 %): se crea, pero marcado como **posible duplicado**. En `/admin` se ve con qué choca y se descarta o se publica.
- Lo que manda una persona (WhatsApp, formulario, email) nunca se descarta solo: puede traer mejor información o el cartel.

`npm run duplicados` repasa los pendientes que ya había y `-- --marcar` los marca.

## Qué no hacer

- No hacer scraping de Instagram, Facebook ni de webs cuyo `robots.txt` lo prohíba (p. ej. `turismo.gal/axenda-cultural/`).
- No copiar textos de prensa ni de agregadores. Tampoco descripciones largas de fuentes oficiales: resumen propio.
- No publicar nada importado sin revisar.
- No descargar más de una vez al día ni sin identificar el bot (`User-Agent: AltofalanteBot`).
- No quitar la atribución de los eventos que vienen de datos con licencia CC BY u ODC-BY.

## Cómo se usa

```bash
npm run revisar-fuentes                     # qué toca revisar hoy
npm run revisar-fuentes -- --marcar concello-nigran concello-baiona
npm run importar                            # ejecuta los importadores activos → pendientes
npm run importar -- cultura-gal             # solo uno
npm run extraer                             # carteles y PDF de data/entrada → pendientes
```

Cada evento guarda su origen en `fuente`:

- `canal`: `whatsapp`, `formulario`, `email`, `ics`, `programa-pdf`, `datos-abiertos` o `manual`.
- `id_fuente`: el id de `fuentes.json`.
- `url`: el enlace original.
- `uid`: el identificador en la fuente, para no importarlo dos veces.
- `atribucion`: el texto que exige la licencia.

La atribución se muestra en la ficha del evento.

### Añadir una fuente

Añade una entrada a `data/fuentes.json` con estos campos:

| Campo | Qué poner |
|---|---|
| `id` | identificador único |
| `nombre`, `tipo`, `concello`, `url` | quién es, qué tipo de fuente es, qué concello cubre y su página |
| `metodo` | `ics`, `api`, `pdf`, `revision-manual` o `envio-directo` |
| `frecuencia` | cada cuánto se revisa |
| `estado` | `verificada` o `sin verificar` |
| `activa` | si se importa |
| `licencia`, `atribucion` | si la licencia lo pide |

Si publica un calendario ICS, basta con `"importador": "ics"`, `url_datos` y `"activa": true`. `npm run validar` comprueba el fichero.
