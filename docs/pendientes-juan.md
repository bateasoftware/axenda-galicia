# Lo que te toca a ti (Juan)

Checklist de lo que depende de ti: cuentas, claves, números, contactos y decisiones. Cada punto dice **qué** hacer, **por qué**, **dónde** y **qué me tienes que devolver**. Las variables de entorno van en Vercel (Settings → Environment Variables) y en tu `.env.local` para probar en local. **No me pases claves por el chat.**

Última actualización: bloque 6 (panel de revisión).

## Bloque 1 · Fuentes

- [ ] **Revisar las fuentes "sin verificar"** de `data/fuentes.json`. Ejecuta `npm run revisar-fuentes -- --todas`; las que salen "(sin verificar)" son las que no pude comprobar.
  - **Por qué:** no encontré su agenda o su web no respondía.
  - **Cuáles:**
    - Cines Municipais da Ramallosa;
    - Biblioteca de Baiona;
    - Mancomunidade de Val Miñor (valminor.info daba error 500);
    - Turismo Rías Baixas (no se ve su agenda);
    - las cuentas de redes;
    - la prensa.
  - **Dónde:** en el navegador. Corrige la URL en `data/fuentes.json` y cambia `"estado"` a `"verificada"`.
  - **Devuélveme:** nada, o la URL buena si quieres que la configure yo.
- [ ] **Pedir la programación por email a los concellos** (cultura de Nigrán, Baiona y Gondomar) y a los Cines da Ramallosa.
  - **Por qué:** sus webs no tienen calendario y es la fuente más fiable.
  - **Dónde:** en sus emails de cultura, con el guion de contacto de `docs/fuentes.md`.
  - **Devuélveme:** nada. Si alguno tiene un calendario de Google o ICS, pásame la URL y lo añado como importador.
- [ ] **Hacer la lista de asociaciones, ANPAs y clubes** a los que escribir.
  - **Por qué:** el tejido asociativo es lo que más eventos trae.
  - **Dónde:** empieza por https://concellodegondomar.gal/asociacions/culturais/ y por tus contactos.
  - **Devuélveme:** nada. Si quieres, añádelos a `data/fuentes.json` con `"metodo": "envio-directo"`.
- [ ] **Decidir la frecuencia de revisión** que de verdad puedes asumir. Ahora es semanal para concellos y prensa, y quincenal o mensual para el resto.
  - **Dónde:** en el campo `frecuencia` de `data/fuentes.json`.

## Bloque 2 · Importadores

- [ ] **Probar la importación en local**: `npm run importar -- --simular` y después `npm run importar`.
  - **Por qué:** para ver qué trae cada fuente antes de dejarla automática. Hoy encuentra unos 8 eventos de Cultura de Galicia y unos 14 de datos.vigo.org.
  - **Dónde:** en tu ordenador. Los pendientes quedan en `data/pendientes/` y se revisan en `/admin` cuando esté (bloque 6).
  - **Devuélveme:** si alguna fuente trae ruido (exposiciones largas, programas), dime si la quieres desactivar (`"activa": false`).
- [ ] **Decidir si importamos las exposiciones y programas largos de Vigo.**
  - **Por qué:** datos.vigo.org solo da la agenda de hoy y sin hora; muchos son programas de varios meses.
  - **Devuélveme:** "sí" o "no". Si es no, filtro en el importador los que duran más de una semana.

## Bloque 3 · Programas en PDF y carteles con varios eventos

- [ ] **Poner `ANTHROPIC_API_KEY` en `.env.local`** si aún no está.
  - **Por qué:** `npm run extraer` y el importador del boletín del SERGAS usan la IA.
  - **Dónde:** https://console.anthropic.com/settings/keys
  - **Devuélveme:** nada (no me pases la clave).
- [ ] **Probar con un programa real**: copia un PDF (p. ej. el programa de Nadal de un concello) en `data/entrada/` y ejecuta `npm run extraer`.
  - **Por qué:** no lo he probado contra la IA real para no gastar llamadas sin tu permiso. Los tests usan una IA simulada.
  - **Devuélveme:** si separa bien los actos o junta o parte de más. Con eso ajusto el prompt de `src/lib/extraccion.ts`.

## Bloque 4 · Duplicados

- [ ] **Validar los umbrales** con casos reales cuando lleguen los primeros duplicados. Hoy: 85 % para no crear otro, 50 % para marcarlo.
  - **Por qué:** con pocos datos he puesto valores prudentes. Mejor marcar de más que perder un evento.
  - **Dónde:** `npm run duplicados` y las marcas "posible duplicado" en `/admin`.
  - **Devuélveme:** ejemplos de falsos positivos o de duplicados que se cuelen, y ajusto `src/lib/duplicados.ts`.

## Bloque 5 · Supabase y WhatsApp Business

### A. Supabase (hace falta antes que WhatsApp y que el panel en Vercel)

**Por qué:** en Vercel no se puede escribir en disco. Los pendientes, los carteles y lo que publiques desde `/admin` se guardan en Supabase, y la web lee de ahí además de los JSON de `data/eventos`.

- [ ] **Crear el proyecto** en https://supabase.com/dashboard → *New project*.
  - Región: Europa (p. ej. Frankfurt). Plan: gratuito.
  - Apunta la contraseña de la base de datos en tu gestor; a mí no me hace falta.
- [ ] **Crear las tablas.** Ve a *SQL Editor* → *New query*, pega el contenido de `supabase/esquema.sql` y pulsa *Run*.
  - Crea las tablas `eventos` y `contactos`, la seguridad (RLS) y el bucket público `carteles`.
  - Se puede repetir sin perder datos.
- [ ] **Copiar las claves** desde *Project Settings → API Keys* (o *Data API*):
  - **Project URL** → variable `SUPABASE_URL`.
  - **Clave secreta**: la `secret` (`sb_secret_…`) o la antigua `service_role` → variable `SUPABASE_SERVICE_ROLE_KEY`. **Es secreta:** solo en Vercel y en tu `.env.local`.
- [ ] **Añadirlas en Vercel**, en *Settings → Environment Variables*, entorno *Production*. Después vuelve a desplegar.
- [ ] **Activar la importación diaria** en GitHub (repo → *Settings → Secrets and variables → Actions*):
  - Secretos: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `ANTHROPIC_API_KEY`.
  - Variable (pestaña *Variables*): `IMPORTAR_ACTIVO` = `true`.
  - Se ejecuta cada mañana (`.github/workflows/importar.yml`). Puedes lanzarla a mano en *Actions → Importar eventos → Run workflow*.
- **Devuélveme:** "Supabase listo". Con eso compruebo en producción que el panel y la web leen bien.

### B. WhatsApp Business (Cloud API)

**Por qué:** es el canal más cómodo para los organizadores. Reenvían el cartel, la IA lo prepara, tú lo apruebas y les llega el aviso con el enlace.

- [ ] **1. Comprar un número nuevo:** una línea prepago o eSIM de cualquier operador. Basta la más barata.
  - El número **no puede estar en uso en la app de WhatsApp**. Si lo estuvo, borra antes esa cuenta.
  - Tiene que poder recibir un SMS o una llamada para verificarlo.
- [ ] **2. Crear el portfolio de empresa** de Meta (Business Manager) en https://business.facebook.com → *Crear cuenta*. Nombre: Axenda (o la marca que elijas).
- [ ] **3. Crear la app** en https://developers.facebook.com/apps:
  - *Crear app* → caso de uso *Conectar con clientes a través de WhatsApp* → enlázala a tu portfolio.
- [ ] **4. Registrar el número** en la app, en *WhatsApp → Configuración de la API* (API Setup):
  - *Añadir número de teléfono*.
  - Nombre visible: "Axenda". Debe cumplir sus normas: el nombre de la marca, sin palabras genéricas.
  - Verifícalo con el SMS.
  - Apunta el **Phone number ID** → variable `WHATSAPP_PHONE_NUMBER_ID`.
- [ ] **5. Crear un token permanente.** En business.facebook.com → *Configuración del negocio → Usuarios → Usuarios del sistema*:
  - *Añadir*, con rol de administrador.
  - *Asignar activos*: la app y la cuenta de WhatsApp, con control total.
  - *Generar token* para la app con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`, sin caducidad → variable `WHATSAPP_TOKEN`.
- [ ] **6. Copiar el secreto de la app**, en *Configuración de la app → Básica → Clave secreta de la app* → variable `WHATSAPP_APP_SECRET`.
- [ ] **7. Inventar un token de verificación**, por ejemplo con `openssl rand -hex 16` → variable `WHATSAPP_VERIFY_TOKEN`.
- [ ] **8. Poner las variables en Vercel** (Production) y volver a desplegar:
  - `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` y `WHATSAPP_VERIFY_TOKEN`;
  - `NEXT_PUBLIC_WHATSAPP_NUMERO` (el número con prefijo y sin "+", p. ej. `34600123456`), para mostrarlo en `/enviar`.
  - Si no lo están ya: `ANTHROPIC_API_KEY` y las de Supabase.
- [ ] **9. Configurar el webhook** en la app → *WhatsApp → Configuración*:
  - *URL de devolución de llamada*: `https://axenda-galicia.vercel.app/api/whatsapp` (o tu dominio).
  - *Token de verificación*: el del paso 7 → *Verificar y guardar*.
  - En *Campos del webhook*, suscríbete a **messages**.
- [ ] **10. Crear la plantilla del aviso de publicación** en *WhatsApp Manager → Plantillas de mensajes → Crear*:
  - Nombre: `evento_publicado`. Categoría: **Utilidad**. Idioma: español.
  - Cuerpo: `Tu evento {{1}} ya está publicado en Axenda: {{2}}`. Ejemplos: "Magosto de Panxón" y `https://axenda-galicia.vercel.app/evento/magosto-panxon-2026`.
  - Cuando la aprueben → variable `WHATSAPP_PLANTILLA_PUBLICADO` = `evento_publicado`.
  - **Por qué:** pasadas 24 h desde el último mensaje del organizador, WhatsApp solo deja escribirle con una plantilla aprobada. Sin ella, el aviso solo llega si publicas en menos de 24 h.
- [ ] **11. Añadir un método de pago** en WhatsApp Manager.
  - Responder a quien te escribe es gratis dentro de las 24 h.
  - Las plantillas de utilidad se cobran por mensaje: céntimos en España. Revisa la tarifa vigente en la página de precios de Meta.
- [ ] **12. Pasar la app a modo "Activo" (Live).** Meta pide la **URL de una política de privacidad**. Hoy la web no tiene: ver la decisión de abajo.
- [ ] **13. Probar:** manda un cartel al número desde tu móvil.
  - Debe contestar "¡Recibido!…" y aparecer en `/admin`.
  - Si no contesta, mira *Vercel → Logs* filtrando por `[whatsapp]`.
- **Devuélveme:** "WhatsApp listo" y el número público, para ponerlo en `/enviar` y en los textos de contacto.

### C. Decisiones

- [ ] **Política de privacidad y aviso legal.** Hacen falta para el modo Live de Meta y por el RGPD: guardamos el número de quien envía, solo para avisarle, y se borra al avisarle o al descartar.
  - **Devuélveme:** quién es el responsable (nombre o razón social, NIF y email de contacto). Con eso redacto `/privacidad` y `/aviso-legal`.

## Bloque 6 · Panel de revisión (/admin)

- [ ] **Elegir la contraseña del panel** y ponerla como `ADMIN_CLAVE` en Vercel (Production) y en tu `.env.local`.
  - Mínimo 8 caracteres; mejor una frase larga o `openssl rand -base64 24`.
  - **Por qué:** sin ella, `/admin` no deja entrar. Si cambias la clave, se cierran todas las sesiones abiertas.
  - **Dónde:** Vercel → *Settings → Environment Variables*; vuelve a desplegar.
  - **Devuélveme:** nada.
- [ ] **Saber cómo se publica según dónde estés:**
  - **En local** (`npm run dev` → http://localhost:3000/admin): publicar escribe en `data/eventos/` y copia el cartel a `public/carteles/`. Después tienes que hacer `git commit` y `push`.
  - **En Vercel** (con Supabase): publicar guarda en Supabase y la web se actualiza sola en unos segundos.
- [ ] **Avisos al organizador:**
  - Si vino por WhatsApp, se le manda solo (con la plantilla del bloque 5 si pasaron más de 24 h).
  - Si vino por email o el formulario, el panel te prepara el mensaje para copiar o responder.
  - Su contacto se borra en cuanto se publica o se descarta el evento.
