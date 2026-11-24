"use client";

export default function BotonRetirar({ accion }: { accion: () => Promise<void> }) {
  return (
    <form
      action={accion}
      onSubmit={(e) => {
        if (!confirm("¿Retirar este evento de la web? Dejará de verse enseguida. Queda guardado como descartado.")) e.preventDefault();
      }}
      className="mt-4"
    >
      <button className="w-full rounded-full border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Retirar de la web</button>
    </form>
  );
}
