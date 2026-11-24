# Lo que te toca a ti (Juan)

Checklist de lo que depende de ti: cuentas, claves, números, contactos y decisiones. Cada punto dice **qué** hacer, **por qué**, **dónde** y **qué me tienes que devolver**. Las variables de entorno van en Vercel (Settings → Environment Variables) y en tu `.env.local` para probar en local. **No me pases claves por el chat.**

Última actualización: bloque 3 (programas en PDF).

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
