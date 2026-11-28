# altofalante: visión, objetivos y decisiones

## Qué es

Una agenda de eventos locales de Galicia que nace de los carteles que la gente ya comparte por WhatsApp y redes sociales: cuentacuentos, encendidos de Navidad, partidos solidarios, mercadillos, cine municipal… Hoy esa información está dispersa y se pierde. altofalante (antes «Axenda») la centraliza, la estructura con IA y la presenta ordenada **por fecha, por ubicación (mapa) y por tipo**.

Visión a largo plazo: convertirse en **el sitio de referencia de lo que pasa en cada comarca de Galicia** y, más adelante, en un medio local que publique noticias y comunicados que no llegan a los medios tradicionales.

## Para quién

- **Público:** familias y vecinos que buscan "qué hacer este finde" y turistas o visitantes de la zona. Es un uso sobre todo móvil: tiene que ir rápido y poder instalarse (PWA).
- **Organizadores:** concellos, asociaciones, ANPAs, clubes, comercios y hostelería. Quieren difusión y hoy solo tienen grupos de WhatsApp y redes.

## Objetivos por fases

1. **Fase 1, ahora: agenda de Val Miñor y Vigo** (Baiona, Nigrán, Gondomar, Vigo).
   - Ser la agenda más completa de la comarca antes de expandirse. Una comarca completa vale más que media Galicia a medias.
   - Entrada de eventos: carteles → extracción con IA → revisión humana rápida → publicación.
   - Crecimiento por SEO: páginas por evento y por concello, datos `schema.org/Event` para aparecer en el buscador de eventos de Google, y contenido en castellano y gallego.
2. **Fase 2: automatizar la entrada y crecer.**
   - Número de WhatsApp Business (Cloud API) al que los organizadores reenvían el cartel, más un formulario web.
   - Panel de revisión (aprobar, editar o descartar) y migración a Supabase (`supabase/esquema.sql`).
   - Newsletter semanal "Plan de finde".
   - Expansión comarca a comarca: O Morrazo, O Baixo Miño, Pontevedra…
3. **Fase 3: medio local.**
   - Sección de noticias y comunicados enviados por la gente, claramente etiquetados como contenido aportado y con verificación editorial.

## Monetización (a medio plazo)

Sin vender activamente. Todo en autoservicio:
- Publicidad (display) cuando haya tráfico.
- **Destacados de pago:** el organizador paga unos euros con Stripe para salir arriba o en la newsletter.
- Patrocinio local de la newsletter o de la página de un concello.
- **Widget insertable** "Agenda de la zona" para webs de hoteles, campings, casas rurales y concellos (pequeña cuota mensual, y además da enlaces).
- Afiliación: venta de entradas y alojamiento cerca de eventos grandes.

## Principios de producto

- **Móvil primero y rápido:** páginas estáticas y coste de infraestructura cercano a cero (Vercel y Supabase en plan gratuito al principio).
- **La IA prepara y una persona decide:** nada se publica sin revisión. Los campos deducidos van en `inferido` y la seguridad de la extracción en `confianza`.
- **Mantenimiento mínimo:** el tiempo disponible es limitado (proyecto paralelo). Hay que priorizar lo que automatiza o lo que trae tráfico.
- **Local de verdad:** la tabla de parroquias y lugares (`data/lugares.json`) es un activo; cuanto más completa, mejor mapa y mejor SEO.
- **Bilingüe:** la interfaz en castellano, respetando el gallego de los carteles (`titulo_gl`). Más adelante, páginas en gallego para SEO.

## Decisiones tomadas

- Eventos comerciales (promociones de tiendas o bares): **sí se publican, pero etiquetados** (`comercial: true`). Son los futuros clientes de destacados.
- Solo se publican **carteles**, nunca fotos de personas, y menos de menores.
- Los datos de contacto que vengan en el cartel (inscripciones) se muestran en la ficha.
- Año ausente en el cartel: se deduce de la fecha de recepción del mensaje (nombre del archivo de WhatsApp).
- Eventos recurrentes ("XVI edición", "un año más") se marcan con `recurrente` para tener la página del año siguiente posicionada antes.

## Aspectos legales que hay que tener presentes

- RGPD y LSSI: aviso legal, política de privacidad y banner de cookies **antes** de meter publicidad o analítica con cookies.
- Derechos sobre los carteles: si lo envía el organizador hay consentimiento. Si se recoge de terceros, pedir permiso o publicar solo los datos con un resumen propio.
- Noticias (fase 3): responsabilidad editorial sobre lo publicado; verificar antes de publicar.

## Cómo medir el éxito

- Eventos publicados por semana y porcentaje que llegan por envío directo (no recogidos a mano).
- Visitas orgánicas mensuales, sobre todo a páginas de concello y "este finde".
- Suscriptores de la newsletter.
- Primeros ingresos por destacados o patrocinio.

## Próximos pasos técnicos (por prioridad)

1. Corregir las coordenadas de `data/lugares.json` y ampliar con los lugares habituales de la comarca.
2. Dominio propio, `NEXT_PUBLIC_SITE_URL` y alta en Google Search Console.
3. Webhook de WhatsApp Business → extracción → `data/pendientes/` (o Supabase).
4. Panel de revisión protegido.
5. Newsletter semanal generada a partir de los eventos del finde. Incluir una línea «Siguen abiertas» con las exposiciones largas en curso (`repartirLargas` en `src/lib/larga-duracion.ts`).
6. Páginas SEO adicionales: "este fin de semana en X", "planes con niños en X", "fiestas de [mes] en X".
