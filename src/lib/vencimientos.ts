/**
 * Cuándo le toca la próxima revisión a un cliente.
 *
 * Es la pieza que convierte la periodicidad contratada en algo accionable: sin
 * esto, el dato está en la ficha y nadie lo mira hasta que el cliente llama
 * preguntando por qué no ha ido nadie.
 *
 * Todo el cálculo es con fechas en formato ISO y aritmética de calendario, no
 * sumando días: «seis meses» desde el 31 de agosto es el 28 de febrero, no el
 * 2 de marzo. Sumar 183 días daría la fecha equivocada según el mes.
 */

/** Hoy, en hora LOCAL. `toISOString()` convierte a UTC y desplaza el día. */
export function hoyISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/**
 * Suma meses a una fecha ISO respetando el calendario.
 *
 * El caso que rompe una implementación ingenua: 31 de agosto + 6 meses. El 31
 * de febrero no existe, y `setMonth` desborda al 2 o 3 de marzo. Aquí se topa
 * al último día del mes de destino, que es lo que cualquiera entiende por
 * «seis meses después».
 */
export function sumarMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const destino = new Date(a, m - 1 + meses, 1);
  const ultimoDia = new Date(
    destino.getFullYear(),
    destino.getMonth() + 1,
    0
  ).getDate();
  const dia = Math.min(d, ultimoDia);
  return `${destino.getFullYear()}-${String(destino.getMonth() + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Días entre dos fechas ISO. Negativo si la segunda ya pasó. */
export function diasHasta(iso: string, desde = hoyISO()): number {
  const [a1, m1, d1] = desde.split("-").map(Number);
  const [a2, m2, d2] = iso.split("-").map(Number);
  const ms = Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1);
  return Math.round(ms / 86_400_000);
}

export type EstadoVencimiento = "vencido" | "proximo" | "al_dia" | "sin_datos";

/** A partir de cuántos días antes se considera que una revisión «se acerca». */
export const DIAS_AVISO = 30;

export type Vencimiento = {
  estado: EstadoVencimiento;
  /** Cuándo toca la próxima. Null si no se puede calcular. */
  proxima: string | null;
  /** Días que faltan; negativo si ya venció. Null si no se puede calcular. */
  dias: number | null;
  /** De dónde sale la cuenta, para poder explicarlo en pantalla. */
  origen: "ultima_visita" | "fecha_instalacion" | null;
};

/**
 * Calcula el vencimiento de un cliente.
 *
 * La cuenta arranca de la última visita ejecutada. Si nunca se le ha hecho
 * ninguna, arranca de la fecha de instalación — es el caso de un cliente
 * recién dado de alta, y es justo el que más fácil se olvida.
 *
 * Sin periodicidad no hay nada que calcular: `sin_datos` no es un error, es
 * que falta rellenar la ficha, y la pantalla lo dice así.
 */
export function calcularVencimiento(cliente: {
  tieneMantenimiento: boolean;
  periodicidadMantenimiento: number | null;
  fechaInstalacion: string | null;
  ultimaVisita: string | null;
}): Vencimiento {
  const vacio: Vencimiento = {
    estado: "sin_datos",
    proxima: null,
    dias: null,
    origen: null,
  };

  if (!cliente.tieneMantenimiento) return vacio;
  if (!cliente.periodicidadMantenimiento) return vacio;

  const base = cliente.ultimaVisita ?? cliente.fechaInstalacion;
  if (!base) return vacio;

  const origen = cliente.ultimaVisita ? "ultima_visita" : "fecha_instalacion";
  const proxima = sumarMeses(base, cliente.periodicidadMantenimiento);
  const dias = diasHasta(proxima);

  return {
    estado: dias < 0 ? "vencido" : dias <= DIAS_AVISO ? "proximo" : "al_dia",
    proxima,
    dias,
    origen,
  };
}

export const NOMBRE_VENCIMIENTO: Record<EstadoVencimiento, string> = {
  vencido: "Vencido",
  proximo: "Próximo",
  al_dia: "Al día",
  sin_datos: "Sin periodicidad",
};

/** Cómo se cuenta el retraso o la espera, en palabras. */
export function textoVencimiento(v: Vencimiento): string {
  if (v.dias === null) return "Falta la periodicidad en la ficha";
  if (v.dias < 0) {
    const d = Math.abs(v.dias);
    return d === 1 ? "Venció ayer" : `Venció hace ${d} días`;
  }
  if (v.dias === 0) return "Vence hoy";
  return v.dias === 1 ? "Vence mañana" : `Vence en ${v.dias} días`;
}
