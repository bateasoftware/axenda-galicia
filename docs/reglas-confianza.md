# Publicación rápida: reglas de confianza

Opcional y **apagada por defecto**. Sirve para no revisar uno a uno lo que llega de emisores que ya han demostrado ser fiables (p. ej. la agenda de Cultura de Galicia). Respeta el principio «la IA prepara y una persona decide»: nada se publica solo, el panel enseña cuántos cumplen y una persona pulsa **Publicar los de confianza**.

## Cómo se activa

Edita `data/reglas.json` y añade reglas a `autopublicar`:

```json
{ "autopublicar": [ { "emisor": "cultura-gal", "confianza_minima": 0.9, "publicados_minimos": 10, "descartes_maximos": 0.1 } ] }
```

- `emisor`: el id de una fuente de `data/fuentes.json` (`cultura-gal`, `vigo-agenda-cultural`…) o un canal (`whatsapp`, `formulario`…).
- `confianza_minima` (0,9 por defecto): confianza de la extracción.
- `publicados_minimos` (5): cuántos eventos de ese emisor tienen que estar ya publicados. Así nunca se aplica a un emisor nuevo.
- `descartes_maximos` (0,1): proporción máxima de descartados sobre publicados + descartados.
- `permitir_deducidos` (false): por defecto, un evento con campos deducidos (`inferido`) no entra.

## Qué entra y qué no

Cumple una regla **y** pasa las mismas comprobaciones que «Publicar» por lotes: sin posible duplicado, sin email de aviso y que pase la validación estricta (fechas, lugar, categorías). Los pendientes «por completar» no entran nunca.

El historial sale de la cobertura (publicados y descartados por emisor). `npm run validar` comprueba que el archivo es válido y que los emisores existen.

## Lo que no hace (todavía)

No publica de forma automática al importar: hay que pulsar el botón en `/admin`. Hacerlo sin intervención exigiría invalidar la caché de la web desde el importador y renunciar a la revisión humana; se puede plantear más adelante para fuentes oficiales concretas.
