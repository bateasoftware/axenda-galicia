"use client";

import { useActionState } from "react";
import { entrar, type EstadoEntrar } from "../acciones";

export default function FormularioEntrar() {
  const [estado, accion, pendiente] = useActionState<EstadoEntrar, FormData>(entrar, {});
  return (
    <form action={accion} className="mt-6 space-y-3">
      <label className="block text-sm font-medium" htmlFor="clave">
        Contraseña
      </label>
      <input
        id="clave"
        name="clave"
        type="password"
        required
        autoComplete="current-password"
        className="w-full rounded-xl border border-[var(--linea)] bg-white px-3 py-2.5"
      />
      {estado.error && <p className="text-sm text-red-700">{estado.error}</p>}
      <button disabled={pendiente} className="w-full rounded-full bg-[var(--tinta)] px-4 py-2.5 font-medium text-white disabled:opacity-60">
        {pendiente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
