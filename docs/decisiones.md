# Decisiones técnicas

Registro de las decisiones que no se deducen leyendo el código, con el motivo
por el que se tomaron. Si alguna deja de tener sentido, se cambia y se anota
aquí por qué.

---

## 2026-08-27 — Módulo de Clientes

### El cliente es una sola ficha; se eliminó la tabla `instalaciones`

**Qué.** `clientes` contiene también los datos del suministro (CUPS, potencias,
inversor, comercializadora). Los mantenimientos cuelgan directamente del
cliente. La tabla y el módulo `instalaciones` desaparecieron.

**Por qué.** El formulario de trabajo real es una fila por cliente con su CUPS
dentro. Tener la instalación aparte obligaba a dar de alta el cliente, guardar,
navegar a su ficha y volver a crear la instalación: dos pasos para un solo dato
de negocio. Un cliente con dos suministros son dos fichas, igual que serían dos
filas en el Excel.

**Consecuencia a tener presente.** Cuando se construya el módulo de **obras
nuevas**, «instalación» significará allí el *trabajo* de instalar (lo del acta
de finalización), no la planta del cliente. Son dos conceptos distintos que
antes compartían nombre.

### La provincia se calcula, no se teclea

En Canarias la isla determina la provincia sin ambigüedad. El campo se rellena
solo desde `provinciaDeIsla()` y se muestra en gris. Se almacena igualmente
para que listados y exportaciones la lleven sin recalcular.

Un dato derivado que se puede teclear es un dato que acabará contradiciéndose.

### Las islas son un tipo `enum` en Postgres, no texto libre

Ocho valores que no van a cambiar. Fijarlos como tipo en la base impide que
cualquier carga de datos futura cuele una isla mal escrita. Lo mismo para la
provincia. La validación de la API es la segunda barrera, no la única.

### El código postal se contrasta con la isla

`35xxx` es Las Palmas y `38xxx` Santa Cruz de Tenerife. Un `38xxx` en Lanzarote
es casi siempre un error de tecleo: se avisa mientras se escribe y el servidor
lo rechaza si se ignora.

### Alta y edición validan con el mismo esquema

`esquemaCliente` en `src/lib/esquemas.ts` es la única definición de qué es un
cliente válido. No hay forma de dejar guardada editando una ficha que el alta
habría rechazado.

---

## 2026-08-27 — Módulo de Mantenimiento

Las cuatro decisiones se tomaron leyendo el contrato de mantenimiento y los dos
informes de referencia que aportó el cliente (`docs/*.pdf`).

### Los informes de referencia no son de mantenimiento

El «Informe de Visita» y el «Acta de finalización de obra» son de SolarYou y
cubren **obra nueva**: estudio técnico previo y entrega posterior. De ahí se
toma el **formato** —etiqueta → valor, foto incrustada en cada punto, firma de
las dos partes— no el contenido.

El peso de esos documentos son las fotos: 24 y 46 respectivamente.

### Cada punto tiene cuatro estados, no un booleano

`sin_revisar` · `correcto` · `incidencia` · `no_aplica`

Un booleano mezclaba tres cosas distintas: revisado y bien, revisado y hay un
problema, y *esta instalación no tiene eso*. El contrato incluye puntos con «en
caso de tenerlos» (los cimientos de la estructura y todo el bloque de baterías),
así que «no aplica» es un estado real del negocio, no una excusa.

`sin_revisar` existe para que un punto en blanco no parezca correcto.

**Una incidencia sin observación no se puede guardar.** Se valida en el
servidor, no solo en pantalla: una incidencia sin explicar no le sirve de nada
a la oficina.

### La visita es semestral o anual, y filtra el checklist

El catálogo real tiene **5 puntos de periodicidad semestral y 19 anuales**
(no mitad y mitad). Una visita semestral muestra 5 puntos; la anual, los 24.

La asimetría es lo que hace que separar los dos tipos merezca la pena: sin el
filtro, en la visita semestral habría 19 puntos que no tocan y acabarían
marcados a la ligera o en blanco.

`itemAplicaAVisita()` en `src/lib/checklist.ts` es la única implementación de
esa regla. La interfaz **no muestra cifras fijas** de puntos porque el catálogo
es editable por el admin y cualquier número quedaría obsoleto.

### Observación por bloque, además de por punto

Tabla propia `mantenimiento_observacion_bloque`, una fila por visita y
categoría. Lo que el técnico tiene que decir muchas veces es del bloque entero
(«toda la estructura con óxido en la cara sur»); repetirlo en sus cinco puntos
sería ruido en el informe.

### Las firmas se guardan en la base; las fotos, no

Las firmas son PNG en base64 dentro de la propia tabla (~20 KB). Son pequeñas,
van atadas al registro que validan y **no dependen del almacenamiento de
objetos**, que sigue pendiente. Eso permitió cerrar el circuito de firma sin
esperar a S3.

Las fotos sí necesitan almacenamiento externo y por eso siguen sin funcionar.

### Firmar congela la visita

Con `firmado = true`, toda la API rechaza cambios: checklist, observaciones de
bloque y datos de la visita. El informe que se lleva el cliente y lo que queda
en la base tienen que decir lo mismo — es la razón de ser de una firma.

No se puede firmar con puntos sin revisar ni con incidencias sin explicar.

### Programar es trabajo de oficina

Un técnico no se auto-asigna trabajo. `POST /api/mantenimientos` exige rol de
escritura, y el `PUT` solo pide ese rol para los campos de planificación
(técnico, tipo, fecha prevista) — el técnico sí puede rellenar su propia visita.

Al asignar se **sugieren** los técnicos de la isla del cliente sin imponerlos:
un desplazamiento entre islas es raro, no imposible.

Programar una visita a un cliente sin mantenimiento contratado se rechaza: casi
siempre es un error de selección.

### La plantilla queda preparada para los otros dos formularios

`checklist_item_definicion.plantilla` es un enum con `mantenimiento`,
`visita_previa` y `acta_obra`. Hoy solo se usa el primero.

**Lo que esto resuelve y lo que no.** Los otros dos formularios entran como
filas nuevas del catálogo y **no obligan a migrar los datos de mantenimiento**.
Pero sí necesitarán una columna más, y conviene tenerlo previsto:

El checklist de mantenimiento es homogéneo — cada punto se responde con el mismo
juego de estados. La visita previa no lo es: pide medidas (`6.40 x 3.90`),
metros de canalización, secciones de cable (`25mm²`), desplegables (`Tipo de
cubierta: Plana`) y sí/no. Son tipos de campo distintos.

Al construir esos módulos habrá que añadir al catálogo algo como
`tipo_campo` (texto · número · medida · si_no · desplegable · foto) y, para los
desplegables, sus opciones. Es un `ALTER TABLE` sobre una tabla de catálogo, no
una migración de datos de trabajo — pero es más que «añadir filas».

---

## 2026-08-27 — Tema claro / oscuro

### Tokens semánticos en lugar de variantes `dark:`

Los componentes no escriben colores crudos (`bg-white`, `text-gray-500`). Usan
tokens de rol (`bg-superficie`, `text-suave`, `border-borde`) definidos una vez
en `src/app/globals.css`.

Con `dark:` duplicado en cada componente, cada pantalla nueva es otra
oportunidad de olvidar la variante y dejar un rectángulo blanco en modo oscuro.
Con tokens, una pantalla nueva sale bien en ambos temas sin pensarlo.

### El verde del logo no puede llevar texto blanco encima

`#899b13` con texto blanco da **3.11:1**, por debajo del mínimo AA de 4.5.
Afectaba al botón principal de toda la aplicación.

Se separaron dos papeles: `--marca` (`#899b13`, el tono exacto del logo) para
decoración que no lleva texto, y `--acento` (`#6d7c0f`, que ya existía en la
paleta como *oliva oscuro*) como relleno de botones, con 4.63:1.

Los 24 pares texto/fondo verificados pasan el mínimo AA en ambos temas.

### El tema se aplica antes de pintar

Un script inline en el `<head>` (`SCRIPT_TEMA` en `src/lib/tema.ts`) escribe
`data-theme` en el `<html>` antes del primer pintado. No se puede resolver desde
React: cuando React monta, el navegador ya ha pintado y se vería el fogonazo
blanco.

Por eso el `<html>` lleva `suppressHydrationWarning`.

**Nota:** la extensión Dark Reader inyecta atributos en los SVG y provoca un
aviso de hidratación que no es un fallo de la aplicación. Con modo oscuro
nativo, esa extensión sobra.

---

## 2026-08-27 — Puesta en marcha local

### Los scripts `db:*` no cargaban el entorno

Ni `drizzle-kit` ni `tsx` leen `.env.local` por su cuenta, y `db:rls` llamaba a
`psql $DATABASE_URL` — pero el instalador de PostgreSQL en Windows no deja
`psql` en el PATH y PowerShell no expande `$VAR` así. Los tres estaban rotos.

`scripts/cargar-env.mjs` **no sobrescribe** variables ya definidas en el
entorno. Es lo que permite que `db:preparar` migre como superusuario mientras
la aplicación corre como `app_user`.

### Las tablas las posee `postgres`, no `app_user`

El propietario de una tabla se salta sus propias políticas RLS. La aplicación
no debe ser dueña de lo que quiere proteger.

---

## 2026-08-27 — Primera ejecución contra PostgreSQL real

Hasta aquí todo estaba verificado por compilador, tipos, lint y pruebas de
lógica pura. La primera ejecución contra una base real sacó un fallo que
ninguna de esas comprobaciones podía ver.

### El login hacía `select *` sobre una tabla con permisos por columna

**Síntoma.** Al entrar, «Error del servidor» — un 500, no un 401 de contraseña
incorrecta.

**Causa.** `app_auth_service` es el único rol que se salta RLS, y por eso tiene
permiso solo sobre unas columnas concretas de `usuarios`. El login pedía
`select *`, que intenta leer además `isla` y `creado_en`. Postgres respondía
`42501 permiso denegado` y la excepción salía como 500.

Para TypeScript, `select *` es perfectamente válido: el fallo solo existe con
los permisos reales delante.

**Arreglo, por las dos caras:**

1. El login pide las columnas **una a una**. Así el código declara lo que
   necesita, y añadir un campo a `usuarios` mañana no vuelve a romper el login.
2. `nombre` se añade al `GRANT` — de 5 columnas a 6. La sesión lo lleva para
   mostrarlo en la barra lateral, y no es sensible: cualquier usuario
   autenticado puede leer los nombres del resto (`usuarios_select`).

**Regla que se lleva de aquí:** con permisos por columna, `select *` es una
bomba de relojería. Cualquier consulta que pase por `dbAuthService` debe listar
sus columnas explícitamente.

### Lo que sí funcionó a la primera

Las 7 tablas, las 15 políticas RLS, y el seed con los 24 puntos del checklist
en el reparto esperado (5 paneles · 5 estructura · 7 inversor · 5 cuadros ·
2 baterías, de los cuales 5 son semestrales).

RLS quedó comprobado en vivo: la misma consulta devuelve 0 filas sin contexto
de sesión y 24 con él.

---

## 2026-08-28 — Despliegue en Hetzner

### Base de datos propia, no una compartida con prefijos

El PostgreSQL del servidor lo comparten otras aplicaciones en una única base
(`db_principal`), con las tablas diferenciadas por prefijo. Esta aplicación va
en su propia base, `mantenimiento_solar`.

**Por qué el prefijo no bastaba.** Tres cosas que no resuelve:

1. El `GRANT ... ON ALL TABLES IN SCHEMA public` que necesita el rol de la app
   habría alcanzado **las 42 tablas de las demás aplicaciones**. No es estilo:
   es un agujero.
2. Los siete tipos enumerados viven en el esquema, no en la tabla, y se llaman
   `isla`, `provincia`, `plantilla`… En un esquema compartido, esta app se
   quedaría con esos nombres para todo el servidor.
3. Las políticas RLS solo protegen si el `GRANT` está acotado.

**Los roles sí llevan prefijo** (`mantsolar_app`, `mantsolar_auth`) porque en
PostgreSQL son globales al clúster, no de la base. Un rol `app_user` chocaría
con el de cualquier otra aplicación del servidor.

### Un script aparte para el servidor

`db:preparar` **no sirve en producción**, por dos razones:

- Crea la base y los roles, y al encontrarlos ya creados les asigna contraseña
  nueva. Eso invalidaría las URLs ya configuradas en el panel de Dokploy.
- Depende de `drizzle-kit` y `tsx`, dependencias de desarrollo que pueden no
  estar en la imagen de producción.

`scripts/aplicar-esquema.mjs` cubre el caso servidor: base y roles ya
existentes, solo aplica migraciones, permisos, RLS y datos. Usa únicamente `pg`
y `bcryptjs`, que son de producción, y corre con `node` a secas.

**Lleva un guardián que rechaza conexiones sin permiso para crear tablas.** No
es solo para fallar antes: un rol sujeto a RLS ve cero filas donde hay
veinticuatro, así que sin la comprobación el script informaba de que había que
sembrar algo ya sembrado. Un script cuyo diagnóstico depende de quién lo
ejecuta es peor que uno que falla.

### El lock file de Windows no sirve para Linux

npm en Windows no materializa el subárbol WASM opcional de
`@tailwindcss/oxide-wasm32-wasi`. El `package-lock.json` generado allí no
describe el árbol que npm construye en Linux y `npm ci` aborta:

```
Missing: @emnapi/core@1.11.3 from lock file
Invalid: lock file's @emnapi/wasi-threads@1.2.1 does not satisfy 1.2.3
```

Comprobado ejecutando `npm ci` en WSL con el lock de Windows, antes de
desplegar. El lock se regenera desde WSL en una copia aislada, para no tocar
los `node_modules` de Windows. Regla en `AGENTS.md`.

### TLS desactivado por defecto, activable por variable

El PostgreSQL del servidor es un contenedor en la red privada de Docker, sin
TLS. Atar el SSL a `NODE_ENV=production` habría dado `The server does not
support SSL connections` y la app no arrancaría. `DATABASE_SSL` sin definir
significa sin TLS; `require` o `strict` lo activan.

### Qué no sube al repositorio

- `.env.local` — contraseñas de los roles y secreto de firma de sesiones.
- `.claude/` — metodología interna de Grupo LMB, no forma parte del producto.
- `docs/*.pdf` — el acta de obra y el informe de visita llevan **nombres, DNI,
  direcciones y fotos de viviendas de clientes reales**. Publicarlos sería una
  cesión de datos sin base legal. El `.xlsx` sí sube: solo tiene cabeceras.

### Un despliegue por cliente, no multiinquilino

La aplicación **no tiene ningún concepto de «empresa»** en el modelo de datos:
ni columna que separe instaladoras, ni política RLS que lo contemple. Cada
cliente es un despliegue propio, con su base y su subdominio — que es además el
patrón que ya sigue el resto de aplicaciones del servidor.

Convertirla en multiinquilino exigiría tocar las siete tablas y las quince
políticas. No está hecho y no está previsto de momento.
