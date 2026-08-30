import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import ListaClientesPagina from "./lista-clientes";

/**
 * Guarda de la pantalla de clientes.
 *
 * La cartera es cosa de oficina: el técnico recibe los datos del cliente
 * dentro de su visita, y desde que la API se lo impide (ver
 * /api/clientes) esta pantalla solo le enseñaba un aviso de permiso
 * denegado con la barra de «Importar» y «Nuevo cliente» encima. No filtraba
 * nada, pero era una puerta que no lleva a ninguna parte.
 *
 * Se comprueba en el servidor, no escondiendo botones: quitarlo del menú no
 * impide escribir la dirección a mano.
 */
export default async function ClientesPage() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.rol === "tecnico") redirect("/mantenimientos");

  return <ListaClientesPagina />;
}
