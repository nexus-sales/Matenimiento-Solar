# App de gestión de mantenimiento — SR Energía

Aplicación interna para gestionar la cartera de clientes fotovoltaicos de SR
Energía y las visitas de mantenimiento que sus técnicos hacen en campo.

**Estado:** los módulos de **Clientes**, **Mantenimiento** y **Usuarios** están
construidos, probados contra PostgreSQL real y **desplegados en producción**
(Hetzner + Dokploy). Quedan dos piezas conocidas: la **subida de fotos** (falta
el almacenamiento S3-compatible) y la **generación del PDF del informe**.

El registro de decisiones, con el motivo de cada una, está en
[`docs/decisiones.md`](docs/decisiones.md).

---

## Índice

- [Stack](#stack)
- [Puesta en marcha en local](#puesta-en-marcha-en-local)
- [Comandos disponibles](#comandos-disponibles)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Modelo de datos](#modelo-de-datos)
- [Seguridad](#seguridad)
- [Los módulos](#los-módulos)
- [Despliegue](#despliegue)
- [Tema claro y oscuro](#tema-claro-y-oscuro)
- [Qué falta](#qué-falta)

---

## Stack

| Pieza | Elección | Nota |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | El middleware se llama `src/proxy.ts`, no `middleware.ts` |
| Lenguaje | TypeScript | |
| Base de datos | PostgreSQL 18 | Autoalojado, con Row Level Security real |
| ORM | Drizzle | Cómodo para el patrón `SET LOCAL` que exige RLS |
| Estilos | Tailwind CSS 4 | Con tokens semánticos propios, ver [Tema](#tema-claro-y-oscuro) |
| Validación | Zod 4 | El mismo esquema valida alta y edición |
| Sesión | JWT (`jose`) en cookie httpOnly | Contraseñas con bcrypt, coste 12 |

---

## Puesta en marcha en local

### Requisito: PostgreSQL arrancado

El instalador de Windows deja PostgreSQL como servicio, pero no siempre en
arranque automático. Si la app no conecta, es lo primero que hay que mirar.
Desde PowerShell **como administrador**:

```powershell
net start postgresql-x64-18
Set-Service -Name postgresql-x64-18 -StartupType Automatic
```

Para comprobar cómo está:

```powershell
Get-Service postgresql-x64-18 | Select-Object Name, Status, StartType
```

> **Ojo con `sc` en PowerShell.** `sc` es un alias de `Set-Content`, así que
> `sc config ...` falla con un error de parámetros que despista. Si copias un
> comando de `cmd.exe`, escribe `sc.exe`.

### Instalación

```bash
npm install
npm run db:preparar
npm run dev
```

`db:preparar` pide la contraseña del superusuario `postgres` y hace todo lo
demás: crea la base `sr_mantenimiento`, los dos roles con contraseñas
aleatorias, escribe el `.env.local`, aplica migraciones y políticas RLS, y
siembra el catálogo del checklist más el primer usuario admin.

Es idempotente. La contraseña del superusuario no se guarda en ningún sitio.

Al terminar imprime el email y la contraseña del admin. **Apúntala** — no se
vuelve a mostrar. Si se pierde:

```bash
npm run db:password
```

### Abrir la app desde otro equipo o desde el móvil

En desarrollo Next sirve sus recursos internos (los chunks y el WebSocket de
recarga en caliente) solo al origen con el que arrancó. Si abres la app por una
IP verás **403 en los `.js` y el WebSocket fallando**, aunque el HTML cargue.

La lista de orígenes permitidos está en `next.config.ts` (`allowedDevOrigins`).
Para añadir uno, **el comodín cubre un segmento entre puntos**: `192.168.*.*`
sí, `192.168.0.0/16` no — no se admite notación de red. Hay que reiniciar el
servidor de desarrollo después de tocarlo.

### Modo de pruebas (saltarse el login)

Para navegar la app sin loguearte cada vez, en `.env.local`:

```
AUTH_MODO_PRUEBAS=true
MODO_PRUEBAS_USER_ID=<uuid del admin>
```

`db:preparar` rellena el uuid automáticamente. Con esto activo, toda petición
se trata como ese admin.

**Solo para local.** Si `AUTH_MODO_PRUEBAS=true` coincide con
`NODE_ENV=production`, la app lanza un error y se niega a arrancar a propósito
(`src/lib/modo-pruebas.ts`), para que no pueda colarse en un despliegue real.

---

## Comandos disponibles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run start` | Servir lo compilado |
| `npm run lint` | ESLint |
| `npm run db:preparar` | **Prepara la base entera de cero, en local.** Crea base y roles |
| `npm run db:esquema` | **Aplica el esquema en un servidor** donde la base y los roles YA existen |
| `npm run db:password` | Cambia la contraseña de un usuario. `-- otro@correo.com` |
| `npm run db:generate` | Genera una migración nueva tras tocar el esquema |
| `npm run db:migrate` | Aplica migraciones pendientes |
| `npm run db:rls` | Aplica `src/db/rls.sql` |
| `npm run db:seed` | Siembra checklist y primer admin |

### Notas sobre los scripts de base de datos

- **No hace falta `psql` en el PATH.** `db:rls` usa el driver `pg`, que ya es
  dependencia. El instalador de PostgreSQL en Windows no añade `psql` al PATH.
- **`drizzle-kit` y `tsx` no leen `.env.local` por su cuenta.** Lo carga
  `scripts/cargar-env.mjs`, que **no pisa** las variables ya definidas en el
  entorno — es lo que permite migrar como superusuario y ejecutar la app como
  `app_user`.
- **El seed corre como propietario de las tablas**, no como el rol de la app:
  escribe en tablas protegidas por RLS.

---

## Estructura del proyecto

```
src/
  app/
    (app)/                    zona autenticada, con sidebar
      clientes/               listado · alta · ficha
      mantenimientos/         listado · programar · visita
      usuarios/               solo admin
      dashboard/
      componentes/            cabecera, tarjeta KPI, selector de tema
    api/
      auth/                   login · logout
      clientes/               GET POST · GET PUT DELETE por id
      mantenimientos/         GET POST · GET PUT DELETE · checklist · firma
      usuarios/
      dashboard/
    login/
    globals.css               sistema de color (tokens semánticos)
  db/
    schema.ts                 definición de las 7 tablas
    rls.sql                   políticas de Row Level Security
    seed.ts                   24 puntos de checklist + primer admin
    migrations/
    index.ts                  pools y conSesionRLS
  lib/
    auth.ts                   sesión JWT
    checklist.ts              periodicidad, estados, categorías
    esquemas.ts               validación de la ficha de cliente
    islas.ts                  8 islas, provincias, códigos postales
    validacion.ts             NIF/NIE/CIF, CUPS, código postal
    permisos.ts               guardas de rol en la API
    tema.ts                   script anti-parpadeo del tema
  proxy.ts                    protección de rutas (era middleware.ts)
    checklist-items.json      los 24 puntos, compartidos por seed y servidor
scripts/
  preparar-bd.mjs             puesta en marcha completa (local)
  aplicar-esquema.mjs         esquema en un servidor ya provisionado
  reiniciar-password.mjs      recuperación de acceso
  aplicar-rls.mjs             políticas sin depender de psql
  cargar-env.mjs              lector de .env que no pisa el entorno
docs/
  decisiones.md               registro de decisiones con su motivo
  *.xlsx                      formulario de referencia (solo cabeceras)
nixpacks.toml                 toolchain del despliegue: Node 22 + npm ci
.gitignore                    excluye .env.local, .claude/ y los PDF con
                              datos personales de clientes reales
```

---

## Modelo de datos

Siete tablas y siete tipos enumerados. Los enums se fijan **en la propia base**,
no solo en la validación de la API: ninguna carga de datos futura puede colar un
valor inventado.

### Tipos enumerados

| Tipo | Valores |
|---|---|
| `isla` | Tenerife · Gran Canaria · Lanzarote · Fuerteventura · La Palma · La Gomera · El Hierro · La Graciosa |
| `provincia` | Las Palmas · Santa Cruz de Tenerife |
| `rol_usuario` | admin · oficina · tecnico |
| `tipo_visita` | semestral · anual |
| `estado_punto` | sin_revisar · correcto · incidencia · no_aplica |
| `categoria_checklist` | paneles · estructura · inversor · cuadros_protecciones · baterias |
| `plantilla` | mantenimiento · visita_previa · acta_obra |

### `clientes` — 21 columnas

El núcleo de la aplicación. Una ficha contiene **todos** los datos del cliente,
incluidos los de su instalación fotovoltaica. Los demás módulos leen de aquí.

| Grupo | Columnas |
|---|---|
| Alta | `fecha_alta` (por defecto hoy) |
| Identificación | `nombre`, `documento` **único** |
| Contacto | `direccion`, `poblacion`, `codigo_postal`, `isla`, `provincia`, `email`, `telefono` |
| Instalación | `cups` **único**, `potencia_contratada`, `potencia_nominal`, `marca_inversor`, `numero_inversor`, `comercializadora`, `tiene_bateria` |
| Servicio | `tiene_mantenimiento`, `comentarios` |

`provincia` se calcula desde `isla`; no se teclea.

### `mantenimientos` — 21 columnas

Una visita.

| Grupo | Columnas |
|---|---|
| Vínculos | `cliente_id` → `clientes` (cascada), `tecnico_id` → `usuarios` |
| Planificación | `tipo` (semestral/anual), `fecha_prevista`, `fecha_ejecucion` |
| Contacto previo | `contactado`, `fecha_contacto`, `via_whatsapp` |
| Cierre | `numero_factura`, `comentarios_generales`, `equipos_reemplazados` |
| Conformidad | `firma_tecnico`, `firmante_tecnico_nombre`, `firmante_tecnico_documento`, `firma_cliente`, `firmante_cliente_nombre`, `firmante_cliente_documento`, `firmado`, `firmado_en` |

Las firmas son PNG en base64 (~20 KB). Van en la base porque son pequeñas, están
atadas al registro que validan y no dependen del almacenamiento de objetos.

### `checklist_item_definicion` — 7 columnas

Catálogo de puntos, editable por el admin. `plantilla`, `categoria`, `nombre`,
`periodicidad_meses`, `orden`, `activo`.

Sembrado con los 24 puntos del contrato: **5 de periodicidad semestral y 19
anuales**, repartidos en paneles (5), estructura (5), inversor (7), cuadros y
protecciones (5) y baterías (2).

### `mantenimiento_checklist_respuesta` — 5 columnas

La respuesta a un punto en una visita concreta: `estado` y `observacion`.
Índice único `unico_item_por_visita` sobre (`mantenimiento_id`, `item_id`) — una
respuesta por punto y visita, sin duplicados posibles.

### `mantenimiento_observacion_bloque` — 4 columnas

Nota sobre un bloque entero. Índice único `unico_bloque_por_visita` sobre
(`mantenimiento_id`, `categoria`).

### `respuesta_foto` — 6 columnas

Varias fotos por punto: `url`, `pie`, `orden`. La URL apunta al almacenamiento
de objetos, con la imagen ya comprimida en el móvil antes de subirla.

### `usuarios` — 8 columnas

`nombre`, `email` **único**, `password_hash`, `rol`, `isla` (solo técnicos),
`activo`.

Las bajas **desactivan**, no borran: se conserva el histórico de qué técnico
hizo cada visita.

### Borrado en cascada

Borrar un cliente arrastra sus mantenimientos, sus respuestas de checklist, sus
observaciones de bloque y sus fotos. Es la única cascada del modelo y está
declarada en las claves foráneas, no en código.

---

## Seguridad

Tres capas, y cada una funciona aunque fallen las otras dos.

### 1. Row Level Security en PostgreSQL

**Las siete tablas tienen RLS activado** y suman **15 políticas**. No es lógica
de aplicación: es la base de datos la que filtra.

La app abre cada transacción declarando quién consulta:

```sql
SET LOCAL app.current_user_id = '<uuid>';
SET LOCAL app.current_user_rol = '<admin|oficina|tecnico>';
```

Eso lo hace `conSesionRLS()` en `src/db/index.ts`, que valida el uuid y el rol
antes de interpolarlos (`SET LOCAL` no admite parámetros preparados).

| Tabla | Políticas | Regla |
|---|---|---|
| `usuarios` | `usuarios_select`, `usuarios_admin_write` | Todos leen; solo admin escribe |
| `clientes` | `clientes_oficina_admin_all`, `clientes_tecnico_read` | Oficina y admin todo; técnico solo lee |
| `mantenimientos` | `mantenimientos_oficina_admin_all`, `mantenimientos_tecnico_propio` | El técnico solo ve y edita **las suyas** |
| `mantenimiento_checklist_respuesta` | `respuesta_oficina_admin_all`, `respuesta_tecnico_propio` | Sigue a su visita padre |
| `mantenimiento_observacion_bloque` | `observacion_bloque_oficina_admin_all`, `observacion_bloque_tecnico_propio` | Sigue a su visita padre |
| `respuesta_foto` | `foto_oficina_admin_all`, `foto_tecnico_propio` | Sigue a la visita de su respuesta |
| `checklist_item_definicion` | `checklist_item_select`, `checklist_item_admin_write`, `checklist_item_admin_update` | Todos leen el catálogo; solo admin lo edita |

**Comprobado en vivo:** la misma consulta sobre el catálogo devuelve 0 filas sin
contexto de sesión y 24 con él.

### 2. Dos roles de Postgres, no uno

**`app_user`** — la conexión normal. Tiene `SELECT INSERT UPDATE DELETE` sobre
las siete tablas, pero **sujeto a RLS**. No es propietario de ninguna tabla: el
propietario se saltaría sus propias políticas, así que las tablas las posee
`postgres`.

**`app_auth_service`** — la única conexión de toda la app con `BYPASSRLS`, y
existe solo porque el login necesita leer `usuarios` **antes** de que haya una
sesión que las políticas puedan comprobar. Su superficie completa:

| Columna de `usuarios` | Acceso |
|---|---|
| `id`, `nombre`, `email`, `password_hash`, `rol`, `activo` | SELECT |
| `isla`, `creado_en` | denegado |
| Cualquier otra tabla | ninguno |

Solo lectura, seis columnas, una tabla. Ni siquiera puede escribir.

> **Con permisos por columna, `select *` es una bomba de relojería.** Cualquier
> consulta que pase por `dbAuthService` debe listar sus columnas
> explícitamente. Un `select *` intentaría leer `isla` y `creado_en`, y Postgres
> respondería con un error de permisos que llega al navegador como un 500.

### 3. Guardas de rol en la API

`exigirRolEscritura()` y `tieneRol()` en `src/lib/permisos.ts`. RLS ya impediría
la escritura sin ellas, pero sin esto un técnico recibiría un error crudo de
Postgres en vez de un 403 con sentido.

El módulo de usuarios añade una cuarta capa: guarda a nivel de página.

### Sesión

JWT firmado con `AUTH_SECRET`, en cookie `httpOnly`, `sameSite: lax`, 12 horas,
`secure` en producción. Contraseñas con bcrypt, coste 12.

---

## Los módulos

### Clientes

Una ficha por cliente con todos sus datos. **No hay tabla `instalaciones`
aparte**: un cliente con dos suministros son dos fichas.

- Validación de **NIF/NIE/CIF** con letra de control verificada, y de formato
  **CUPS**.
- **Isla** como desplegable de las 8 canarias.
- **Provincia** derivada de la isla, no editable.
- **Código postal** contrastado con la isla: un `38xxx` en Lanzarote avisa
  mientras se escribe y el servidor lo rechaza.
- **Mantenimiento** como desplegable Sí/No — decide si el cliente entra en la
  planificación de visitas.
- Listado con búsqueda libre (nombre, documento, CUPS, dirección) y filtros por
  isla y por mantenimiento.
- Histórico de visitas dentro de la propia ficha.
- Alta y edición validan con **el mismo esquema**: no se puede dejar guardado
  editando algo que el alta habría rechazado.

### Mantenimiento

- **Programar visita** con asignación de técnico. Se sugieren los de la isla del
  cliente sin imponerlos. Se rechaza programar a un cliente sin mantenimiento
  contratado.
- **Semestral o anual.** La semestral muestra solo los puntos de periodicidad
  semestral; la anual, el checklist completo.
- **Cuatro estados por punto**: sin revisar · correcto · incidencia · no aplica.
  El contrato tiene puntos con «en caso de tenerlos» (cimientos, baterías), así
  que «no aplica» es un estado real del negocio.
- **Una incidencia sin observación no se guarda.** Se valida en el servidor.
- **Observación por punto y por bloque.**
- **Firma manuscrita** del técnico y del cliente sobre el propio dispositivo,
  con nombre y documento de cada firmante.
- **Al firmar, la visita queda inmutable.** Toda la API rechaza cambios. No se
  puede firmar con puntos sin revisar ni con incidencias sin explicar.
- Guardado punto a punto según avanza el técnico, no al final: en una cubierta
  con mala cobertura, perder media hora de trabajo no es aceptable.
- La pantalla abre con dirección, isla, CUPS, inversor y batería a la vista.

### Usuarios

Solo admin. Alta, cambio de rol e isla, activar y desactivar. Un admin no puede
quitarse su propio rol ni desactivarse a sí mismo.

---

## Despliegue

Desplegado en **Hetzner con Dokploy**, compilación **Nixpacks**, desde
[`nexus-sales/Matenimiento-Solar`](https://github.com/nexus-sales/Matenimiento-Solar)
rama `main`.

### Base de datos propia, no compartida

El PostgreSQL del servidor lo comparten otras aplicaciones en una única base
(`db_principal`, con decenas de tablas y las tablas diferenciadas por prefijo).
**Esta aplicación va en su propia base**, `mantenimiento_solar`, por tres
motivos que el prefijo no resuelve:

1. El `GRANT ... ON ALL TABLES IN SCHEMA public` que necesita el rol de la app
   habría alcanzado **las tablas de todas las demás aplicaciones**.
2. Los siete tipos enumerados se llaman `isla`, `provincia`, `plantilla`… y en
   un esquema compartido esta app se quedaría con esos nombres para todo el
   servidor.
3. Las políticas RLS solo protegen si el `GRANT` está acotado.

Los **roles sí llevan prefijo de producto** (`mantsolar_app`, `mantsolar_auth`)
porque en PostgreSQL los roles son globales al clúster, no de la base: un rol
llamado `app_user` chocaría con el de cualquier otra aplicación.

### Variables de entorno en el panel

```
DATABASE_URL=postgresql://mantsolar_app:...@HOST_INTERNO:5432/mantenimiento_solar
DATABASE_URL_AUTH_SERVICE=postgresql://mantsolar_auth:...@HOST_INTERNO:5432/mantenimiento_solar
AUTH_SECRET=...
NODE_ENV=production
PORT=3000
```

`HOST_INTERNO` es el nombre del servicio de PostgreSQL dentro de la red de
Docker, no `localhost` — dentro del contenedor, `localhost` es la propia app.

**No definir `AUTH_MODO_PRUEBAS`**: con `NODE_ENV=production` la aplicación se
niega a arrancar a propósito. **No definir `DATABASE_SSL`**: sin TLS es lo
correcto para un PostgreSQL en red privada de Docker.

### Crear el esquema tras el primer despliegue

Las tablas **no viajan con el código**. Una vez desplegado, desde el servidor:

```bash
APP=$(docker ps --format '{{.Names}}' | grep '^srenergia' | head -1)
PGPASS=$(docker exec <contenedor-postgres> printenv POSTGRES_PASSWORD)
URL="postgresql://admin_apps:$PGPASS@HOST_INTERNO:5432/mantenimiento_solar"

# Simular primero: informa de lo que haría, sin tocar nada
docker exec -e DATABASE_URL_ADMIN="$URL" -e SIMULAR=si "$APP" node scripts/aplicar-esquema.mjs

# Aplicar de verdad
docker exec -e DATABASE_URL_ADMIN="$URL"   -e SEED_ADMIN_EMAIL='...' -e SEED_ADMIN_PASSWORD='...'   "$APP" node scripts/aplicar-esquema.mjs
```

`DATABASE_URL_ADMIN` es la conexión del **superusuario**: el rol de la
aplicación no puede crear tablas, y eso es deliberado. Vive solo en ese
comando; nunca se pone en el panel.

**`db:preparar` no sirve en el servidor**: crea la base y los roles, y al
encontrarlos ya creados les asigna contraseña nueva, lo que invalidaría las
URLs del panel. Además depende de `drizzle-kit` y `tsx`, que son dependencias
de desarrollo. `db:esquema` usa solo `pg` y `bcryptjs`.

### El lock file se regenera desde WSL, nunca desde PowerShell

npm en Windows no materializa el subárbol WASM opcional de
`@tailwindcss/oxide-wasm32-wasi`, así que el `package-lock.json` generado ahí
no describe el árbol que npm construye en Linux y **`npm ci` aborta**. Está
comprobado en este proyecto, no es teórico. Ver el bloque de reglas en
`AGENTS.md`.

## Tema claro y oscuro

Selector de tres estados (claro · sistema · oscuro) en el sidebar, con
**sistema** por defecto.

El tema se aplica con un script inline en el `<head>` **antes del primer
pintado**: no se puede resolver desde React porque, cuando React monta, el
navegador ya ha pintado y se vería el fogonazo blanco.

Los componentes **no escriben colores crudos**. Usan tokens de rol
(`bg-superficie`, `text-suave`, `border-borde`) definidos una vez en
`src/app/globals.css`. Con `dark:` duplicado en cada componente, cada pantalla
nueva sería otra oportunidad de olvidar la variante.

Los 24 pares de texto y fondo verificados pasan el mínimo AA de WCAG en ambos
temas.

> El aviso de hidratación que pueda aparecer en el navegador con SVG lo causa la
> extensión **Dark Reader**, no el código. Con modo oscuro nativo, esa extensión
> sobra.

---

## Qué falta

1. **Subida y compresión de fotos.** El modelo ya admite varias por punto
   (`respuesta_foto`, con pie y orden) y el botón está en su sitio, deshabilitado
   a la espera del almacenamiento S3-compatible. Es el único lugar de la interfaz
   que muestra algo que todavía no funciona, y está marcado como tal. Está
   pendiente decidir dónde se guardan: MinIO en el servidor propio, un bucket de
   proveedor, o disco del VPS.
2. **Generación del PDF + envío a oficina.** Va junto con las fotos: el peso de
   los informes de referencia son las fotos (24 y 46 en los ejemplos de `docs/`).
3. **Importación del Excel.** Las claves únicas (documento, CUPS) ya están en el
   modelo; falta el importador.
4. **Módulo de obras nuevas** — informe de visita previa y acta de finalización.
   Van los últimos a propósito: las fotos y el PDF son la maquinaria que más
   necesitan, así que se construye una vez y sirve para los tres.
   El catálogo ya tiene `plantilla` preparado, pero necesitarán además una
   columna de **tipo de campo**: esos formularios piden medidas, metros y
   desplegables, no solo estados. Ver `docs/decisiones.md`.
5. **HTTPS en el subdominio.** Obligatorio antes de las fotos: el navegador
   del móvil bloquea el acceso a la cámara sin certificado.
