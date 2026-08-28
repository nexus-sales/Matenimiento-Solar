export type Tema = "claro" | "oscuro" | "sistema";

export const CLAVE_TEMA = "sr-tema";

export const TEMAS: { valor: Tema; etiqueta: string }[] = [
  { valor: "claro", etiqueta: "Claro" },
  { valor: "sistema", etiqueta: "Sistema" },
  { valor: "oscuro", etiqueta: "Oscuro" },
];

export const CONSULTA_OSCURO = "(prefers-color-scheme: dark)";

/**
 * Script que se inyecta en el <head> y se ejecuta ANTES de pintar nada.
 *
 * Sin esto la página se dibujaría primero con el tema por defecto y
 * cambiaría al oscuro un instante después: el fogonazo blanco clásico. No
 * se puede resolver desde React porque para cuando React monta, el
 * navegador ya ha pintado.
 *
 * Va envuelto en try/catch porque localStorage lanza excepción en modo
 * privado de algunos navegadores; si falla, se cae al tema del sistema.
 */
export const SCRIPT_TEMA = `
(function(){
  try {
    var guardado = localStorage.getItem(${JSON.stringify(CLAVE_TEMA)});
    var tema = guardado === "claro" || guardado === "oscuro" ? guardado : "sistema";
    var oscuro = tema === "oscuro" ||
      (tema === "sistema" && window.matchMedia(${JSON.stringify(CONSULTA_OSCURO)}).matches);
    document.documentElement.setAttribute("data-theme", oscuro ? "dark" : "light");
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`.trim();

/** Escribe el tema efectivo en el <html>. Es lo único que lee el CSS. */
export function aplicarTema(tema: Tema) {
  const oscuro =
    tema === "oscuro" ||
    (tema === "sistema" && window.matchMedia(CONSULTA_OSCURO).matches);
  document.documentElement.setAttribute(
    "data-theme",
    oscuro ? "dark" : "light"
  );
}

export function leerTemaGuardado(): Tema {
  try {
    const guardado = localStorage.getItem(CLAVE_TEMA);
    if (guardado === "claro" || guardado === "oscuro") return guardado;
  } catch {
    // localStorage bloqueado: se usa el del sistema, que siempre funciona.
  }
  return "sistema";
}

export function guardarTema(tema: Tema) {
  try {
    if (tema === "sistema") localStorage.removeItem(CLAVE_TEMA);
    else localStorage.setItem(CLAVE_TEMA, tema);
  } catch {
    // Si no se puede persistir, el tema vale para esta sesión y ya.
  }
}
