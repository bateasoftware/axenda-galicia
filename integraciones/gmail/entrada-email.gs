/**
 * Axenda · entrada de carteles por email (Google Apps Script).
 *
 * Cada 10 minutos busca correos con la etiqueta "axenda/entrada", manda sus imágenes
 * a /api/entrada y marca el hilo con "axenda/procesado" o "axenda/error".
 * Instalación paso a paso: docs/entrada-automatica.md
 *
 * Propiedades del script (Configuración del proyecto → Propiedades del script):
 *   ENTRADA_URL       https://<tu-dominio>/api/entrada
 *   ENTRADA_SECRETO   el mismo valor que en Vercel
 */

var ETIQUETAS = { entrada: "axenda/entrada", procesado: "axenda/procesado", error: "axenda/error" };
var MAX_HILOS_POR_VUELTA = 10; // cada cartel tarda ~30 s; Apps Script corta a los 6 minutos
var TAMANO_MINIMO = 20 * 1024; // por debajo suelen ser logos de firmas o iconos
var TAMANO_MAXIMO = 4 * 1024 * 1024; // límite del endpoint

/** Ejecútalo una vez a mano: crea las etiquetas y el disparador cada 10 minutos. */
function instalar() {
  Object.keys(ETIQUETAS).forEach(function (k) {
    if (!GmailApp.getUserLabelByName(ETIQUETAS[k])) GmailApp.createLabel(ETIQUETAS[k]);
  });
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "procesarCorreos") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("procesarCorreos").timeBased().everyMinutes(10).create();
  Logger.log("Instalado: etiquetas creadas y disparador cada 10 minutos.");
}

function procesarCorreos() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty("ENTRADA_URL");
  var secreto = props.getProperty("ENTRADA_SECRETO");
  if (!url || !secreto) throw new Error("Faltan ENTRADA_URL o ENTRADA_SECRETO en las propiedades del script.");

  var procesado = GmailApp.getUserLabelByName(ETIQUETAS.procesado);
  var conError = GmailApp.getUserLabelByName(ETIQUETAS.error);
  var entrada = GmailApp.getUserLabelByName(ETIQUETAS.entrada);
  var consulta = 'label:"' + ETIQUETAS.entrada + '" -label:"' + ETIQUETAS.procesado + '" -label:"' + ETIQUETAS.error + '"';
  var hilos = GmailApp.search(consulta, 0, MAX_HILOS_POR_VUELTA);

  hilos.forEach(function (hilo) {
    var problemas = [];
    var enviados = 0;
    hilo.getMessages().forEach(function (mensaje) {
      var imagenes = mensaje.getAttachments({ includeInlineImages: true }).filter(function (a) {
        // Carteles (imágenes) y programas en PDF
        return /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/i.test(a.getContentType()) && a.getSize() >= TAMANO_MINIMO;
      });
      imagenes.forEach(function (adjunto) {
        if (adjunto.getSize() > TAMANO_MAXIMO) {
          problemas.push(adjunto.getName() + ": pasa de 4 MB");
          return;
        }
        var res = UrlFetchApp.fetch(url, {
          method: "post",
          headers: { Authorization: "Bearer " + secreto },
          payload: {
            imagen: adjunto.copyBlob(),
            canal: "email",
            recibido: Utilities.formatDate(mensaje.getDate(), "Europe/Madrid", "yyyy-MM-dd'T'HH:mm"),
            // Solo el principio del texto: suele traer fecha o lugar si faltan en el cartel
            nota: mensaje.getPlainBody().slice(0, 1000),
          },
          muteHttpExceptions: true,
        });
        var codigo = res.getResponseCode();
        var cuerpo = {};
        try {
          cuerpo = JSON.parse(res.getContentText());
        } catch (e) {}
        if (codigo === 201 || codigo === 200) {
          enviados++;
          Logger.log(adjunto.getName() + " → " + cuerpo.estado + " " + (cuerpo.pr || cuerpo.motivo || (cuerpo.eventos ? cuerpo.eventos.length + " eventos" : "")));
          if (cuerpo.estado === "rechazado") problemas.push(adjunto.getName() + ": " + cuerpo.motivo);
        } else {
          problemas.push(adjunto.getName() + ": HTTP " + codigo + " " + (cuerpo.motivo || ""));
        }
      });
    });
    if (!enviados && !problemas.length) problemas.push("sin carteles ni PDF");

    if (problemas.length) {
      hilo.addLabel(conError);
      Logger.log("Con errores: " + hilo.getFirstMessageSubject() + " · " + problemas.join(" | "));
    } else {
      hilo.addLabel(procesado);
    }
    hilo.removeLabel(entrada);
  });
}
