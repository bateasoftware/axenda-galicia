/* Widget "Agenda de la zona" de Axenda.
 * Uso: <div data-axenda-agenda data-concello="nigran" data-n="6" data-tema="claro"></div>
 *      <script src="https://axenda-galicia.vercel.app/widget.js" async></script>
 */
(function () {
  var script = document.currentScript;
  var origen = script ? new URL(script.src).origin : "https://axenda-galicia.vercel.app";
  var marcos = {};
  document.querySelectorAll("[data-axenda-agenda]:not([data-axenda-listo])").forEach(function (el, i) {
    el.setAttribute("data-axenda-listo", "");
    var id = "axenda-" + i + "-" + Math.random().toString(36).slice(2, 7);
    var q = new URLSearchParams({ id: id });
    ["concello", "n", "tema"].forEach(function (k) {
      var v = el.getAttribute("data-" + k);
      if (v) q.set(k, v);
    });
    var f = document.createElement("iframe");
    f.src = origen + "/widget/agenda?" + q.toString();
    f.title = "Agenda de eventos";
    f.loading = "lazy";
    f.style.cssText = "width:100%;border:0;min-height:200px;border-radius:12px;overflow:hidden";
    f.setAttribute("scrolling", "no");
    el.appendChild(f);
    marcos[id] = f;
  });
  window.addEventListener("message", function (e) {
    if (e.origin !== origen || !e.data || e.data.axenda !== "altura" || !marcos[e.data.id]) return;
    marcos[e.data.id].style.height = e.data.altura + "px";
  });
})();
