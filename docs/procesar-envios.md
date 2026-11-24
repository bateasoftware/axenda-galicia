# Procesar envíos (carteles de WhatsApp, textos y enlaces)

Guía para la sesión de Claude Code que procesa lo que Juan le pasa: fotos de WhatsApp (con o sin texto), PDF de programas, texto suelto o enlaces. Sin la API de pago de Claude, **la extracción la hace esta sesión**; Juan revisa y publica en `/admin`.

## Reglas

- **Nunca publicas.** Todo entra como pendiente y Juan lo publica.
- **Resumen siempre propio.** No copies textos de prensa, agregadores ni de la página del evento.
- **Nada de Instagram ni Facebook** (extracción automática, prohibida por sus condiciones). Si Juan pega un enlace de redes, pídele el cartel o el texto.
- **Datos de quien envía:** no se guardan ni se escriben (teléfonos, nombres). Solo lo que dice el cartel.
- **Enlaces:** usa WebFetch y respeta `robots.txt`. Si la página no deja leerla, dilo.
- **No editas código ni haces commits** en esta sesión: solo añades pendientes.

## Flujo por cada envío

1. **Mira el material.** Una imagen se lee directamente en el chat. Un PDF, con la herramienta de lectura. Un enlace, con WebFetch.
2. **Extrae los eventos.** Cuántos hay:
   - Un cartel de un evento → un evento (con varias `sesiones` si tiene varios días u horarios).
   - Un programa con actos distintos → **un evento por acto**.
   - Ignora lo que no sea un evento con fecha y lo que esté fuera de Galicia.
3. **Escribe un JSON mínimo** (ejemplo abajo) en `/private/tmp/…` (carpeta temporal de la sesión; no en el proyecto).
4. **Añade los pendientes:**

   ```bash
   npm run anadir-pendiente -- evento.json --imagen cartel.jpg --canal whatsapp --recibido 2026-11-24T10:00
   ```

   - `--imagen`: la foto del cartel (se reduce y se le quitan los metadatos). Si Juan te pasa una foto en el chat y no tienes el archivo, añade el evento sin imagen: él puede subir el cartel después desde el panel.
   - `--canal`: `whatsapp` (por defecto), `manual` (enlaces, texto suelto), `email`, `formulario` o `programa-pdf`.
   - `--recibido`: cuándo llegó (si lo sabes: el nombre de los archivos de WhatsApp lo lleva, `…PHOTO-2026-11-19-09-52-44.jpg`). Sirve para deducir el año si el cartel no lo dice.
   - `--url`: el enlace de donde sale, si lo hay (se muestra en el panel).
   - `--simular`: enseña lo que haría sin guardar nada.
5. **Responde a Juan** con un resumen corto por envío: qué eventos has dejado, qué has deducido y qué dudas hay.

El comando valida los datos (si hay errores, no guarda nada y te dice cuáles), calcula el slug y las coordenadas, no vuelve a añadir el mismo cartel y marca los posibles duplicados con lo ya publicado o pendiente.

## Formato del JSON

Un evento o una lista de eventos. Los campos que faltan se completan solos; un campo mal escrito da error.

```json
[
  {
    "titulo": "Magosto popular de Panxón",
    "titulo_gl": "Magosto popular de Panxón",
    "resumen": "Castañas asadas, música y juegos para toda la familia.",
    "sesiones": [{ "inicio": "2026-11-29T17:00", "fin": "2026-11-29T20:00" }],
    "lugares": [{ "nombre": "Parque da Ramallosa" }],
    "concello": "Nigrán",
    "organizadores": ["ANPA do CEIP de Panxón"],
    "categorias": ["gastronomia", "infantil"],
    "precio": "Gratis",
    "idioma": "gl",
    "inferido": ["año (el cartel no lo dice; se deduce de la fecha de recepción)"],
    "confianza": 0.85
  }
]
```

| Campo | Obligatorio | Notas |
|---|---|---|
| `titulo`, `resumen` | sí | El título en castellano; `titulo_gl` con el original si está en gallego. Resumen de 1-2 frases propias |
| `sesiones` | sí | `inicio` como `"YYYY-MM-DDTHH:MM"` en 24 h. **Si el cartel no dice la hora, solo `"YYYY-MM-DD"`** (nunca `00:00`). Evento de varios días: `inicio` y `fin` con el primer y el último día. Un acto por sesión si hay programa por horas (con `nota`) |
| `lugares` | sí | Basta con `nombre` (y `direccion` si sale). Las coordenadas se calculan: sitio conocido de `data/lugares.json` o centro del concello, marcadas como aproximadas. Pon `lat` y `lng` solo si las conoces |
| `concello` | sí | Baiona, Nigrán, Gondomar, Vigo… Si deduces el concello del escudo o logo, anótalo en `inferido` |
| `categorias` | sí | Una o más de: navidad, fiestas, musica, cine, teatro, infantil, deporte, solidario, mercadillo, gastronomia, cultura, comercial |
| `organizadores` | no | Solo los que salen en el cartel. No inventes |
| `precio`, `publico`, `extras` | no | Solo lo que diga el cartel |
| `inscripcion` | no | `{ "url", "telefono", "email", "hasta": "YYYY-MM-DD" }` solo si el cartel lo pone |
| `parroquia` | no | |
| `idioma` | no | `gl`, `es` (por defecto) o `mixto`: el del cartel |
| `inferido` | no | Todo lo que **deduces** y no se lee literalmente (año, hora de cierre, concello por el escudo…). Juan lo ve como aviso |
| `confianza` | no | 0–1 (por defecto 0,8). Bájala si hay datos dudosos |
| `recurrente` | no | `true` si pone «XVI edición» o «un año más» |
| `comercial` | no | `true` si es la promoción de un negocio |

## Si Juan te pasa un lote de imágenes

Procesa una a una, con un resumen al final con el total. Si varias fotos son del mismo evento (cartel y foto del programa), crea un único evento.

## Si el comando no puede conectar con la base de datos

Falta `TURSO_DATABASE_URL` o `TURSO_AUTH_TOKEN` en `.env.local`: no lo abras ni lo imprimas (es secreto). Sin ellas, el comando guarda en `data/pendientes/` (local) y Juan los sube con `npm run subir-pendientes`. Díselo.
