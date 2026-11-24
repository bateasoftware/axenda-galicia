# Entrada automática de eventos

Cada cartel que llega se convierte en un **pull request** listo para revisar. La IA prepara el evento y una persona decide: nada se publica hasta que alguien fusiona el PR (ver `docs/vision.md`).

```
email ─┐
web ───┼─► /api/entrada ─► Claude extrae los datos ─► PR en GitHub ─► revisas ─► fusionar = publicado
(WhatsApp, más adelante)       (cartel reducido, sin metadatos)   (CI + vista previa de Vercel)
```

## Cómo se revisa

1. Llega un aviso de la app de GitHub: *"Encendido de Navidad · 2026-11-22 · Gondomar"*.
2. En el PR se ven la fecha, el lugar, la confianza y lo que la IA ha **deducido**. La CI comprueba el JSON y Vercel publica una vista previa con la ficha tal como quedará.
3. Elige:
   - **Fusionar** → se publica en unos minutos.
   - **Corregir** → *Files changed* → editar `data/eventos/<slug>.json` en el propio PR → fusionar.
   - **Descartar** → cerrar el PR (y borrar la rama).

Etiquetas: todos llevan `evento-entrante`; los que tienen datos deducidos, confianza baja o errores llevan además `revisar-datos`. Si un PR empieza por ⚠️, la CI fallará hasta que se corrija.

Si el mismo cartel vuelve a llegar, no se abre otro PR: se añade un comentario en el que ya está abierto.

## Puesta en marcha (una vez)

### 0. Privacidad del repositorio

Los PRs y los carteles pendientes quedan en el repositorio. **Si es público, cualquiera los ve antes de que los revises.** El PR nunca incluye el email ni el texto de quien lo envía, pero lo recomendable es hacerlo privado: GitHub → Settings → General → *Danger Zone* → *Change visibility*. Vercel sigue desplegando igual.

### 1. Token de GitHub

GitHub → Settings → Developer settings → *Fine-grained tokens* → *Generate new token*:

- **Repository access:** solo `axenda-galicia`.
- **Permissions:** *Contents* (Read and write), *Pull requests* (Read and write), *Issues* (Read and write, para etiquetas y comentarios). *Metadata* (Read) va incluido.
- Caducidad: un año, y apúntate renovarlo.

### 2. Variables en Vercel

Vercel → proyecto → Settings → Environment Variables (entorno *Production*):

| Variable | Valor |
|---|---|
| `ANTHROPIC_API_KEY` | tu clave de la API de Claude |
| `GITHUB_TOKEN` | el token del paso 1 |
| `GITHUB_REPO` | `bateasoftware/axenda-galicia` |
| `ENTRADA_SECRETO` | una clave larga al azar: `openssl rand -hex 32` |

Vuelve a desplegar para que las tome. Sin ellas, `/api/entrada` responde 503 y el resto de la web funciona igual.

Prueba rápida desde tu ordenador (crea un PR de verdad: ciérralo después):

```bash
curl -X POST https://axenda-galicia.vercel.app/api/entrada -H "Authorization: Bearer $ENTRADA_SECRETO" -F canal=manual -F imagen=@public/carteles/acendido-nadal-gondomar-2026.jpg
```

(Ese cartel ya está publicado, así que el slug saldrá con `-2`.)

### 3. Canal de email (Gmail + Apps Script)

1. **Filtro de Gmail.** Configuración → Filtros → Crear filtro:
   - *Para:* `bateasoftware+eventos@gmail.com` **o** *Asunto:* `Nuevo evento para la agenda` (el asunto que pone el botón de `/enviar`).
   - *Tiene archivos adjuntos.*
   - Acción: *Aplicar la etiqueta* `axenda/entrada` (créala si no existe).

   Los correos que lleguen de otra forma se procesan poniéndoles esa etiqueta a mano o reenviándolos a `bateasoftware+eventos@gmail.com`.
2. **Script.** Entra en [script.google.com](https://script.google.com) con la misma cuenta → *Nuevo proyecto* → pega el contenido de `integraciones/gmail/entrada-email.gs`.
3. **Propiedades.** ⚙️ Configuración del proyecto → *Propiedades del script*: `ENTRADA_URL` = `https://axenda-galicia.vercel.app/api/entrada` y `ENTRADA_SECRETO` = el mismo que en Vercel.
4. **Instalar.** Elige la función `instalar` → *Ejecutar* → acepta los permisos (leer y etiquetar tu Gmail, conectarse a servicios externos). Crea las etiquetas y un disparador cada 10 minutos.

Después de cada vuelta, el hilo pasa a `axenda/procesado` o a `axenda/error`. Para reintentar uno con error: quítale `axenda/error` y vuelve a ponerle `axenda/entrada`. El registro de cada ejecución está en *Ejecuciones* del proyecto de Apps Script.

## Límites y detalles

- Imágenes de hasta **4 MB** (Vercel no acepta peticiones mayores). Las de WhatsApp siempre caben; una foto del móvil sin comprimir puede no caber: queda en `axenda/error`.
- El cartel se guarda a 1600 px como máximo y en JPEG, **sin metadatos** (ubicación GPS, modelo del móvil…).
- Solo se mandan las imágenes de más de 20 KB, para no procesar logos de firmas.
- El texto del correo se usa solo para completar fecha, hora o lugar. No pasa al PR.
- Coste: una llamada a la IA por cartel nuevo. Los duplicados no gastan.
- Sigue existiendo el flujo manual (`npm run extraer` → `npm run publicar`), útil para cargar muchos carteles de golpe.

## Próximos canales

- **Formulario web** en `/enviar`: subirá la imagen al mismo endpoint (con Cloudflare Turnstile como antispam).
- **WhatsApp Business Cloud API**: un webhook que reenvía la imagen al mismo endpoint y contesta "Recibido". Necesita número propio y verificar el negocio en Meta.
