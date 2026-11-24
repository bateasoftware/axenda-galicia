# Lo que te toca a ti (Juan)

Todo el código está hecho. Lo que queda depende de ti: crear cuentas, poner claves y decidir. **No me pases claves por el chat.**

Última actualización: filtro por emisor y descarte por lotes en el panel; sesión de procesado de envíos.

## Qué cuesta dinero y qué no

| Servicio | Para qué | Coste | Estado |
|---|---|---|---|
| **Turso** | Base de datos: pendientes, publicados y carteles | Gratis (plan gratuito, sin tarjeta) | ✅ Usar ahora |
| **Vercel** (plan Hobby) | Alojar la web | Gratis. Ojo: Hobby es para uso **no comercial**; cuando metas publicidad o destacados de pago habrá que pasar a Pro | ✅ Ya lo usas |
| **GitHub Actions** | Importar eventos cada mañana | Gratis | ✅ Usar ahora |
| **Gmail + Apps Script** | Recibir carteles por email | Gratis | Opcional |
| **Cloudflare Turnstile** | Antispam del formulario | Gratis | Solo si llega spam |
| **API de Claude** (`ANTHROPIC_API_KEY`) | Leer el cartel y rellenar los datos solo | **De pago por uso**: unos céntimos por cartel | ⏸ Aparcado |
| **WhatsApp Business** | Que te manden carteles a un número | **Número de teléfono** (una línea) + **avisos tras 24 h** (céntimos por mensaje). Recibir y contestar en 24 h es gratis | ⏸ Aparcado |
| **Vercel Blob** | Guardar carteles fuera de la base de datos | Ya no hace falta: los carteles van en Turso | ✖ No usar |
| **Supabase** | Alternativa a Turso | Gratis, pero no hace falta | ⏸ Más adelante, si quieres (hay migración preparada) |
| **Dominio propio** | `axenda.gal` o similar | Unos euros al año | ⏸ Cuando decidas la marca |

### Sin la API de Claude, ¿cómo entran los eventos?

**Todo sigue funcionando:** el formulario de `/enviar`, el email y las fuentes automáticas. La diferencia es quién rellena los datos:

- **Carteles sueltos (formulario, email):** llegan al panel `/admin` como **"✍️ Por completar"**, con el cartel y lo que escribió quien lo mandó. Rellenas título, fecha, lugar y categorías mirando el cartel. Son 1 o 2 minutos por cartel.
- **Muchos carteles o un programa en PDF:** déjalos en `data/entrada/` y **pídeme a mí** (Claude Code) "extrae los carteles de data/entrada". Lo hago con tu suscripción, sin la API. Después ejecutas `npm run subir-pendientes` y los revisas en `/admin`.
- **Fuentes automáticas** (Cultura de Galicia y agenda de Vigo): no usan IA, así que siguen igual. Solo el boletín del SERGAS (un PDF) necesita la IA; sin ella, lo extraigo yo cuando me lo pidas.

## Cómo se usa el panel `/admin`

- **Pendientes** (lo que llega): abre uno, rellena y pulsa **Publicar**. Sin hora, sin coordenadas: solo lo que sepas.
  - **Cuándo:** elige el día. La hora es opcional. Si dura varios días, pon el último en «Hasta el día» y deja las horas vacías. «+ Añadir otro día u horario» para más sesiones.
  - **Dónde:** escribe el nombre del sitio. Si es uno conocido, se pone su ubicación; si no, se usa el centro del concello (aproximada). Las coordenadas son opcionales, dentro de «Coordenadas».
  - **Cartel:** si no tiene, «Añadir un cartel» sube una imagen (se reduce sola). Si ya tiene, «Cambiar el cartel».
  - **Filtrar por emisor:** debajo del título hay un botón por cada origen (`vigo-agenda-cultural`, `cultura-gal`, WhatsApp, formulario…) con su número de pendientes, y filtros para «Posibles duplicados» y «Por completar».
  - **Descartar por lotes:** cada pendiente tiene una casilla. Marca los que quieras, o pulsa «Seleccionar los N» para marcar todos los de la vista filtrada, y «Descartar». Lo descartado no vuelve a entrar al importar.
- **Publicados** (botón arriba, `/admin/publicados`): todos los eventos que se ven en la web, próximos y pasados. Entra en uno para **editarlo** (título, fechas, lugar, cartel…) o **retirarlo** de la web.
  - La dirección de la página (`/evento/…`) no cambia al editar.
  - Los 5 eventos iniciales viven en el repositorio (`data/eventos`). Salen marcados "Repositorio": al guardar cambios pasan a la base de datos y se editan desde ahí; al retirarlos se ocultan. No hay que tocar nada en GitHub.
  - Retirar no borra: queda guardado como descartado.

## Fuentes de «revisión manual» y la sesión de procesado

Las fuentes de `revision-manual` de `data/fuentes.json` (webs de concellos, bibliotecas, turismo…) **no se importan solas**: no tienen calendario ni feed. `npm run revisar-fuentes` solo te recuerda cuáles toca mirar.

Para no tener que entrar tú en cada web, hay una **sesión aparte** que lo hace por ti (sin la API de pago):

- **Qué haces tú:** abres la sesión «Procesar envíos de WhatsApp y enlaces» y le pasas lo que te llega:
  - fotos de WhatsApp, con o sin texto;
  - PDF de programas;
  - enlaces a eventos;
  - o le dices «revisa las fuentes de hoy».
- **Qué hace ella:** lee cada cosa, extrae los eventos, los deja como **pendientes** y te resume qué ha dejado y qué dudas hay. Tú los revisas y publicas en `/admin`.
- **Límites:** solo lee webs que dejan leerse (respeta `robots.txt`). **Nada de Instagram ni Facebook**: si el cartel está ahí, pásale la imagen o el texto. Nunca publica ella.
- **Cómo funciona por dentro:** `npm run anadir-pendiente` y la guía `docs/procesar-envios.md`.

## Ahora (todo gratis), en este orden

### 1. Crear la base de datos en Turso

Tienes la herramienta de Turso instalada en el Mac y con sesión iniciada (cuenta `bateasoftware`, donde ya está `radar-gasolineras`). Hay dos opciones:

- **A. La creo yo.** Dime "crea la base de Turso" y ejecuto estos comandos por ti, enseñándote lo que hago. Al final te digo dónde quedan los valores; no hace falta que me los pases.
- **B. La creas tú**, en la Terminal, dentro de la carpeta del proyecto:

```bash
turso db create axenda
```

```bash
turso db show axenda --url
```

```bash
turso db tokens create axenda
```

El primer comando crea una base **nueva** solo para Axenda, sin tocar la de `radar-gasolineras`. El segundo te da la **URL** (empieza por `libsql://`) y el tercero un **token** (una cadena larga). Guarda los dos en tu gestor de contraseñas.

No hay que crear tablas ni configurar nada más en Turso: la web las crea sola la primera vez.

### 2. Poner las claves (dónde va cada cosa)

Las "claves" son valores que la web lee al arrancar (variables de entorno). Van en **dos sitios**:

**a) En Vercel (para la web publicada).** Vercel → proyecto `axenda-galicia` → *Settings* → *Environment Variables*. Añade una a una, marcando *Production*:

| Nombre | Valor |
|---|---|
| `TURSO_DATABASE_URL` | la URL del paso 1 (`libsql://…`) |
| `TURSO_AUTH_TOKEN` | el token del paso 1 |
| `ADMIN_CLAVE` | una contraseña que **inventas tú** para entrar en `/admin` (mínimo 8 caracteres; mejor una frase larga) |

Después: *Deployments* → en el último, menú ⋯ → *Redeploy*. Sin esto no se aplican.

**b) En tu Mac (para probar en local y para los comandos `npm run …`).** Crea un archivo llamado `.env.local` en la carpeta del proyecto con estas tres líneas:

```
TURSO_DATABASE_URL=libsql://…
TURSO_AUTH_TOKEN=…
ADMIN_CLAVE=…
```

Ese archivo no se sube nunca a GitHub (está en `.gitignore`). Si eliges la opción A del paso 1, te lo creo yo.

**No pongas `ANTHROPIC_API_KEY`:** es la clave de la API de Claude, que se paga por uso. Mientras no esté, todo funciona en modo "por completar".

### 3. Activar la importación diaria (GitHub)

Cada mañana trae solos los eventos de Cultura de Galicia y de la agenda de Vigo a tu panel.

1. Ve a https://github.com/bateasoftware/axenda-galicia → *Settings* → *Secrets and variables* → *Actions*.
2. En *Secrets* → *New repository secret*, crea `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` con los mismos valores.
3. En la pestaña *Variables* → *New repository variable*: nombre `IMPORTAR_ACTIVO`, valor `true`.
4. Para probarla ya: *Actions* → *Importar eventos* → *Run workflow*.

### 4. Probar que todo va

1. Entra en `https://axenda-galicia.vercel.app/enviar` y manda un cartel de prueba con el formulario.
2. Entra en `https://axenda-galicia.vercel.app/admin` con tu `ADMIN_CLAVE`. Debe aparecer como "✍️ Por completar".
3. Rellénalo y pulsa *Publicar* (o *Descartar* si era de prueba).
4. **Devuélveme:** "probado", o lo que haya fallado. Si falla, mira *Vercel → Logs*.

## Cuando puedas (gratis, pero lleva tu tiempo)

- [ ] **Revisar las fuentes "sin verificar".** Ejecuta `npm run revisar-fuentes -- --todas` para verlas.
  - **Cuáles:** Cines da Ramallosa, Biblioteca de Baiona, Mancomunidade de Val Miñor (su web daba error), Turismo Rías Baixas, redes y prensa.
  - **Qué hacer:** corrige la URL en `data/fuentes.json` y pon `"estado": "verificada"`, o pásame la URL buena.
- [ ] **Escribir a concellos, asociaciones, ANPAs y clubes.** El guion está en `docs/fuentes.md`. Empieza por https://concellodegondomar.gal/asociacions/culturais/.
  - **Por qué:** que te manden ellos los carteles es lo que más eventos trae.
  - **Devuélveme:** si alguno tiene un calendario de Google o un ICS: lo añado como fuente automática.
- [ ] **Revisar las fuentes manuales cuando toque.** `npm run revisar-fuentes` te dice cuáles tocan hoy. Al terminar, márcalas con `npm run revisar-fuentes -- --marcar id1 id2`.
- [ ] **(Opcional) Carteles por email.** Sigue `docs/entrada-automatica.md`. Es gratis y necesita las variables `ENTRADA_SECRETO` en Vercel, un filtro de Gmail y un script de Apps Script.
- [ ] **Difundir el widget** (`/widget`) entre hoteles, campings, casas rurales y concellos.
- [ ] **Mirar `/admin/cobertura`** cada semana o cada dos, para ver qué canal funciona.

## Decisiones pendientes

- [ ] **Política de privacidad y aviso legal.** Hacen falta por el RGPD: guardamos el email de quien manda un evento, solo para avisarle, y se borra al publicar. También los pide Meta si algún día activas WhatsApp.
  - **Devuélveme:** quién es el responsable (nombre o razón social, NIF y email de contacto). Con eso redacto `/privacidad` y `/aviso-legal`.
- [ ] **¿Importamos las exposiciones y programas largos de Vigo?** Su agenda abierta solo da lo de hoy y sin hora. **Devuélveme:** "sí" o "no". Si es no, los filtro.
- [ ] **Umbral de duplicados.** Ahora: 85 % para no crear otro y 50 % para marcarlo. Avísame si ves falsos positivos.

## Aparcado (tiene coste): cuando quieras activarlo

### API de Claude (extracción automática)

- **Qué hace:** lee el cartel o el PDF y rellena los datos solo. Tú solo revisas y publicas.
- **Coste:** pago por uso, unos céntimos por cartel. Se puede poner un límite de gasto mensual en la consola.
- **Cómo activarlo:**
  - Crea la clave en https://console.anthropic.com/settings/keys y ponla como `ANTHROPIC_API_KEY` en Vercel y en `.env.local`.
  - Si quieres que también funcione la importación diaria del boletín del SERGAS, añádela además como secreto en GitHub.
  - No hay que tocar nada más: el código lo detecta.

### WhatsApp Business (Cloud API)

- **Qué hace:** los organizadores reenvían el cartel a un número de Axenda. Les contesta "¡Recibido!" y les avisa al publicar.
- **Coste:**
  - una línea de teléfono que **no** tenga WhatsApp instalado;
  - recibir mensajes y contestar en menos de 24 h: gratis;
  - avisar pasadas 24 h: necesita una plantilla, que cuesta céntimos por mensaje. Sin plantilla, el panel te da el número y el texto para avisar tú a mano, gratis.
- **Pasos** (unas 2 horas, la mayoría esperando verificaciones):
  1. Comprar la línea (prepago o eSIM).
  2. Crear el portfolio de empresa en https://business.facebook.com.
  3. Crear una app en https://developers.facebook.com/apps (caso de uso: *Conectar con clientes a través de WhatsApp*) y registrar el número en *WhatsApp → Configuración de la API*. Apunta el **Phone number ID**.
  4. Crear un usuario del sistema con un token permanente con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`. Apunta la **clave secreta de la app**.
  5. Poner en Vercel `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` (inventada) y `NEXT_PUBLIC_WHATSAPP_NUMERO`.
  6. Configurar el webhook `https://axenda-galicia.vercel.app/api/whatsapp` con ese token de verificación y suscribirse a **messages**.
  7. Pasar la app a modo *Live*: pide la política de privacidad.
- **Devuélveme:** cuando quieras activarlo, te acompaño paso a paso.

### Pasar de Turso a Supabase (gratis, pero no hace falta)

Está preparado para que sea un trámite de unos 20 minutos, sin tocar código:

1. Crea el proyecto en Supabase y ejecuta `supabase/esquema.sql` en su *SQL Editor*.
2. Pon `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`, **junto a** las de Turso.
3. Ejecuta `npm run migrar-a-supabase`. Copia todo, carteles incluidos.
4. Pon las variables de Supabase en Vercel y quita las de Turso.

## Referencia: todas las variables

| Variable | Para qué | ¿Hace falta ahora? |
|---|---|---|
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Base de datos | **Sí** |
| `ADMIN_CLAVE` | Contraseña del panel `/admin` | **Sí** |
| `NEXT_PUBLIC_SITE_URL` | Dirección de la web (cuando tengas dominio) | No |
| `ANTHROPIC_API_KEY` | Extracción automática con IA (de pago) | No (aparcado) |
| `ENTRADA_SECRETO` | Carteles por email (Apps Script) | Opcional |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Antispam del formulario | Solo si hay spam |
| `WHATSAPP_*`, `NEXT_PUBLIC_WHATSAPP_NUMERO` | WhatsApp Business | No (aparcado) |
| `BLOB_READ_WRITE_TOKEN` | Carteles en Vercel Blob | No (van en Turso) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Si algún día pasas a Supabase | No |
| `GITHUB_TOKEN`, `GITHUB_REPO` | Recibir por email sin base de datos (abre PRs; necesita la IA) | No |
