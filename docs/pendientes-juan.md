# Lo que te toca a ti (Juan)

Checklist de lo que depende de ti: cuentas, claves, números, contactos y decisiones. Cada punto dice **qué** hacer, **por qué**, **dónde** y **qué me tienes que devolver**. Las variables de entorno van en Vercel (Settings → Environment Variables) y en tu `.env.local` para probar en local. **No me pases claves por el chat.**

Última actualización: bloque 1 (fuentes).

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
