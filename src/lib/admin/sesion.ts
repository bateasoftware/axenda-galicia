import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Acceso al panel con una sola contraseña (ADMIN_CLAVE). La cookie guarda una firma derivada
// de la clave: cambiar ADMIN_CLAVE cierra todas las sesiones.
export const COOKIE = "axenda_admin";
const DURACION = 60 * 60 * 24 * 30; // 30 días

export const claveConfigurada = () => !!process.env.ADMIN_CLAVE && process.env.ADMIN_CLAVE.length >= 8;

function firma(): string {
  return createHmac("sha256", process.env.ADMIN_CLAVE!).update("axenda-admin-v1").digest("hex");
}

function iguales(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function claveCorrecta(intento: string): boolean {
  return claveConfigurada() && iguales(intento, process.env.ADMIN_CLAVE!);
}

export async function autorizado(): Promise<boolean> {
  // Primero la cookie: así el panel es siempre dinámico, aunque ADMIN_CLAVE se añada después del build
  const valor = (await cookies()).get(COOKIE)?.value;
  if (!claveConfigurada()) return false;
  return !!valor && iguales(valor, firma());
}

/** Para páginas y acciones del panel: si no hay sesión, a la pantalla de entrada */
export async function exigirAdmin(): Promise<void> {
  if (!(await autorizado())) redirect("/admin/entrar");
}

export async function abrirSesion() {
  (await cookies()).set(COOKIE, firma(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION,
  });
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE);
}
