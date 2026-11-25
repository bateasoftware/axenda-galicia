import { connection } from "next/server";
import { Suspense } from "react";
import { claveConfigurada } from "@/lib/admin/sesion";
import FormularioEntrar from "./FormularioEntrar";

export default function Entrar() {
  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="font-display text-3xl">Panel de revisión</h1>
      <Suspense fallback={null}>
        <Contenido />
      </Suspense>
    </div>
  );
}

// En cada petición (no en el build): si ADMIN_CLAVE se añade después, se nota sin volver a compilar
async function Contenido() {
  await connection();
  return claveConfigurada() ? (
    <FormularioEntrar />
  ) : (
    <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
      Falta la variable <code>ADMIN_CLAVE</code> (mínimo 8 caracteres) en Vercel o en <code>.env.local</code>.
    </p>
  );
}
