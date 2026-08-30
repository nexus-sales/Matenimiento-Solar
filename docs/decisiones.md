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

---

## 2026-08-28 — Qué congela una firma, exactamente

### El número de factura no es parte del acta

Aparecía en el PDF pero **no había forma de rellenarlo**: no existía en
ninguna pantalla, y al firmar toda la visita quedaba inmutable.

La raíz fue tratar la visita como un bloque único. Pero lo que el cliente
firma es el trabajo: checklist, observaciones, fotos y fechas. El número de
factura lo asigna la oficina después, al facturar, y el cliente no lo ha
visto nunca. Congelarlo con el resto era un error de categoría.

Ahora una visita firmada admite **solo** ese campo; cualquier otro cambio se
sigue rechazando. Y al cambiarlo se borra el acta guardada, porque el número
va impreso en ella y el archivo dejaría de ser correcto.

### Los técnicos nunca se ocultan por isla

El alta de visita filtraba los técnicos por la isla del cliente. En las islas
menores no hay técnico fijo —se desplaza uno de las capitalinas— así que el
desplegable salía vacío y bloqueaba una asignación legítima.

Ahora se muestran todos, con los de la isla primero y el resto agrupados bajo
«Con desplazamiento». Filtrar por conveniencia estaba impidiendo el caso real.

---

## Deuda consciente — llevar la aplicación fuera de Canarias

**Estado: no hecho, a propósito.** Anotado para que el día que aparezca un
cliente peninsular no se empiece de cero.

### Qué ata hoy la aplicación a Canarias

1. **`isla` es un tipo `enum` de PostgreSQL** con ocho valores, usado en
   `clientes.isla` y `usuarios.isla`.
2. **`provincia` se deriva de la isla** (`provinciaDeIsla` en `src/lib/islas.ts`)
   y es otro enum, con dos valores.
3. **El código postal se valida contra la isla** (`desajusteCodigoPostal`).
4. **El técnico se asigna por isla**, que es el concepto operativo: un técnico
   no se desplaza entre islas a diario.

### La abstracción correcta

Una **«zona operativa»**: en Canarias es la isla, en la península es la
provincia. Es el ámbito en el que un técnico trabaja sin desplazamiento
extraordinario, que es para lo que se usa de verdad.

### Por qué no se hace ahora

- **Sería especulativo.** No se sabe qué necesita esa segunda empresa, y hay
  riesgo real de inventar una abstracción que no encaje con su caso.
  Generalizar sin el segundo ejemplo delante es el error clásico.
- **Esperar no encarece.** La migración cuesta prácticamente lo mismo hoy que
  con mil clientes dentro: columna nueva, migrar datos, retirar el enum.

### Lo que ya juega a favor

**El código postal es universal en España** y sus dos primeros dígitos son el
código de provincia, en Canarias y en Cuenca. Ya se guarda y se valida, así
que la información geográfica real está en la base de datos y no hay que
pedirla otra vez.

### Plan de migración, cuando toque

1. Tabla `zonas` (`codigo`, `nombre`, `provincia`), sembrada por despliegue:
   las 8 islas para SR Energía, las 52 provincias para un cliente peninsular.
2. `clientes.zona_id` y `usuarios.zona_id` en lugar de los enums.
3. `provincia` pasa a derivarse del código postal, no de la isla — regla que
   funciona en todo el país.
4. Retirar `provinciaDeIsla` y `desajusteCodigoPostal`, sustituidos por la
   comprobación de que el código postal pertenece a la provincia de la zona.
5. Retirar los tipos `isla` y `provincia`.

Los textos de la interfaz que dicen «isla» pasarían a decir «zona», salvo que
se quiera mantener el término por despliegue.

---

## 2026-08-28 — Anular en vez de reabrir

Si alguien firma una visita por error, hasta ahora la única salida era borrarla
y perder el checklist.

**Se anula, no se reabre.** La visita firmada se marca como anulada dejando
escrito quién y por qué, y se programa otra que hereda cliente, tipo y técnico.
Su acta pasa a llevar una banda roja de «ACTA ANULADA — SIN VALIDEZ».

**Por qué no reabrir.** Retirar la firma y dejar la visita editable era más
cómodo —no hay que rehacer el trabajo— pero rompe la única garantía que sostiene
el documento: un acta que el cliente firmó podría acabar con un contenido
distinto, y el PDF que ya recibió dejaría de coincidir con el archivado.

**Por qué no borrar.** Dejaría un hueco sin explicación en el histórico del
cliente, y el acta anulada quizá ya se le envió. Conservarla marcada es lo que
permite entender después qué pasó.

**Por qué solo administración.** Es una corrección sobre un documento firmado
por dos partes, no una operación de trabajo diario.

La banda va arriba y ocupa el ancho, no es una marca de agua diagonal: una marca
de agua se confunde con un fondo decorativo, una banda roja al principio de cada
página no se pasa por alto.

---

## 2026-08-30 — De un formulario a tres

El cliente pidió el módulo de obras nuevas: informe de visita previa y acta de
finalización. Lo primero que se decidió es que **no son tres módulos, son tres
plantillas del mismo motor**. Un formulario que se rellena en el móvil, se firma
por técnico y cliente y produce un PDF: eso ya existía, y lo único que cambia es
qué campos trae y cómo se responde cada uno.

### El renombrado se hizo a mano, no con drizzle-kit

`drizzle-kit` **se negó a generar la migración**: no puede distinguir un
renombrado de un borrar-y-crear, y pide confirmarlo por consola. Fue una suerte
— una migración generada a ciegas habría recreado las tablas y borrado los datos.

Se escribió a mano: `mantenimientos` → `intervenciones`,
`checklist_item_definicion` → `plantilla_campo`,
`mantenimiento_checklist_respuesta` → `respuestas`,
`mantenimiento_observacion_bloque` → `observaciones_bloque`. Todo son `RENAME`,
incluidas restricciones e índices, que **PostgreSQL no renombra solo** al
renombrar su tabla. Los nombres reales estaban truncados a 63 caracteres y hubo
que consultarlos en la base.

Las **rutas y los textos siguen diciendo «mantenimientos»**. El usuario piensa
en mantenimientos y obras, no en «intervenciones», que es un nombre del modelo.

### Las políticas RLS sobrevivieron solas al renombrado

Comprobado en la base después de migrar: `respuesta_tecnico_propio` se reescribió
sola y ahora dice `FROM intervenciones m`. PostgreSQL las guarda por
identificador interno, no por texto. Era el punto que más podía haber mordido en
silencio — una política que apunta a una tabla que ya no se llama así dejaría de
proteger sin dar ningún error.

### El campo se responde de siete maneras, no solo con un estado

El acta de obra es sobre todo un protocolo fotográfico y la visita previa pide
medidas y metros, así que `plantilla_campo` gana `tipo`: estado, foto, texto,
numero, medida, si_no o lista. Más `obligatorio`, `unidad`, `opciones` y `ayuda`.

**`respuestas.valor` se guarda como texto a propósito.** Una medida es
«6.40 x 3.90» y una sección «25mm²». No son números: son lo que el técnico
escribió, y forzarlos a un tipo numérico perdería el dato. El tipo `numero` solo
cambia el teclado que abre el móvil.

### El bloque deja de ser un enum

`categoria_checklist` tenía cinco valores, los del contrato. La visita previa
habla de sombras y canalizaciones; el acta, de anclajes y subcuadros.

Se podría haber ampliado el enum, y se descartó por dos razones. De diseño:
obligaría a una migración cada vez que un instalador quiera un bloque propio, y
el editor de plantillas existe justo para evitarlo. Y técnica, que fue la que
zanjó el asunto: **`ALTER TYPE ... ADD VALUE` no permite usar el valor nuevo en
la misma transacción**, así que migración y siembra no podrían ir juntas.

Ahora es texto. La lista de bloques conocidos vive en `src/lib/plantillas.ts`, y
un bloque desconocido se muestra igual con su clave como título: mejor un nombre
feo que un formulario que se come campos en silencio.

### Los catálogos se transcribieron de formularios rellenos

51 campos en la visita previa (24 fotos) y 56 en el acta (48 fotos). Salieron de
los dos PDF de referencia, que estaban **rellenos, no en blanco**: de la visita
previa solo era visible la rama «conectada a red», así que si existe un juego de
campos para instalación aislada, falta. Queda anotado en el README.

### Qué bloquea la firma depende del tipo

El checklist exige sus 24 puntos: dejar uno sin mirar es dejar la visita a
medias. En las otras dos plantillas solo bloquean los marcados obligatorios —hay
campos que no aplican a una obra concreta, como la marca de la batería cuando no
lleva batería, y exigirlos todos obligaría al técnico a rellenar basura para
poder cerrar.

La regla vive en un solo sitio porque **el servidor tiene que aplicar la misma al
firmar**: si solo la comprobara el navegador, no la comprobaría nadie.

---

## 2026-08-30 — Auditoría completa: lo que encontró y lo que se cambió

Se pasaron los cuatro pases de la familia de skills —Explorador, Fontanero,
Auditor y Council— sobre el repositorio entero. Lo que sigue son las decisiones
que salieron de ahí.

### El acta de obra se emitía titulada «Acta de mantenimiento»

El hallazgo más grave, y no era de seguridad. El generador tenía **cuatro
literales fijos**: el título del documento, el subtítulo, el encabezado de
sección y el pie de página, que se repite en todas las hojas. Las tres
plantillas pasaban por ahí.

Es el papel que firma el cliente. Un acta de finalización de obra que se
presenta a sí misma como acta de mantenimiento describe mal lo que se firmó.
Ahora los cuatro textos vienen de `TEXTOS_DOCUMENTO`, junto al resto del
registro de plantillas.

**Comprobado renderizando de verdad**, no compilando: un acta con 96 fotos en
los 8 bloques da 10 páginas, con las 96 colocadas y los 56 campos presentes.
Para renderizar fuera de Next hay que empaquetar con esbuild en formato ESM —
`@react-pdf/hyphenate` solo declara la condición `import` en sus *exports*, y
`tsx` lo convierte a `require`.

### Dos comprobaciones que contaban en vez de verificar

El Council lo identificó como **un mismo error de diseño repetido**, y es la
lección más útil de toda la auditoría: cada vez que hizo falta saber si algo
estaba aplicado, se contó en lugar de comparar. Las dos fallaban en silencio
diciendo que todo iba bien.

**RLS se saltaba entero si ya existía alguna política.** Un cambio en `rls.sql`
no llegaba nunca a un servidor ya desplegado. Ahora se compara el hash del
contenido, y para que reaplicar sea seguro `rls.sql` pasa a ser idempotente:
cada una de sus 15 políticas lleva delante su `DROP ... IF EXISTS`.

Quedó demostrado el mismo día: al aplicar la política nueva de clientes, el
número de políticas **siguió siendo 15 antes y después**. La comprobación vieja
no lo habría detectado jamás.

**El registro de migraciones daba por aplicada solo la primera.** Ante una base
con esquema y registro vacío, las intermedias quedaban pendientes y fallaban al
reintentarlas. Es lo que pasó con la `0004` y obligó a un `insert` a mano.

El script no puede saber hasta dónde llegó un esquema existente, así que **ya no
lo adivina**: para, lista las migraciones y pide que se le diga cuál es la
última aplicada. Parar es peor experiencia que adivinar, y mucho mejor que
adivinar mal contra una base con datos.

### La cartera de clientes estaba abierta a cualquier técnico

`GET /api/clientes` solo comprobaba que hubiera sesión, y la política
`clientes_tecnico_read` dejaba leer la tabla entera. Una sola petición devolvía
nombre, DNI, dirección, teléfono, email y CUPS de todos.

Decisión del cliente, sin matices: **una cartera de quién tiene placas
instaladas es el activo del negocio**, y no hay motivo para que quepa entera en
la sesión de alguien que va a hacer una visita concreta.

Se cerró por dos sitios, que **no son dos capas de lo mismo sino dos agujeros
distintos**: una guarda de rol en la ruta, que impide listarlas de golpe, y la
política `clientes_tecnico_asignados`, que es la que cierra también la ficha
individual por `/api/clientes/[id]`. Quien aplicara solo la primera se quedaría
tranquilo sin motivo.

Los datos que el técnico necesita le siguen llegando dentro de su visita.

### El login no tenía límite de intentos, y el reloj delataba los emails

Única ruta accesible sin sesión. Sin límite se podían probar contraseñas
indefinidamente, y bcrypt con coste 12 la convertía además en un amplificador de
carga que cualquiera podía activar sin autenticarse. Ahora 8 intentos por
ventana de 15 minutos, por email **y** por IP.

El mensaje de error ya no distinguía entre email inexistente y contraseña mala,
pero el tiempo sí: sin usuario no se llamaba a bcrypt y la respuesta llegaba
~250 ms antes. Ahora se verifica contra un hash señuelo. Medido: 405 ms frente a
399 ms.

### El permiso de columna, donde el `GRANT` no lo deshaga

`mantsolar_app` podía leer `password_hash`. No se filtraba nada porque las cinco
consultas piden columnas explícitas, pero el día que alguien escriba `select()`
sobre esa tabla los hashes salen al navegador. Ya pasó una vez, con el login.

El `REVOKE` va en `aplicar-esquema.mjs`, justo detrás del `GRANT ... ON ALL
TABLES`, y no en `rls.sql`. **Ese GRANT se ejecuta en cada despliegue**, así que
un `REVOKE` en cualquier otro sitio se desharía solo en el siguiente.

### Cabeceras sí, CSP no todavía

Se añadieron `X-Frame-Options`, `nosniff`, `Referrer-Policy`,
`Permissions-Policy` y HSTS. `camera=(self)` es obligatorio: el técnico hace las
fotos desde el navegador.

**Sin CSP a propósito.** La app inyecta un script en línea para que el tema no
parpadee al cargar, y una CSP sin la excepción correcta lo bloquearía sin dar
ningún error. Merece su propio paso.

### Esconder un botón no es una guarda

Al quitar «Clientes» del menú del técnico quedaba la puerta abierta: escribiendo
la dirección a mano llegaba a la pantalla y veía la barra de «Importar» y
«Nuevo cliente» sobre un aviso de permiso denegado. No se filtraba nada, pero
era una pantalla rota.

Ahora hay guarda en el servidor para `/clientes`, `/clientes/nuevo` y
`/clientes/importar`. **`/clientes/[id]` se queda accesible a propósito**: ahí
quien decide es RLS, no el rol, y es como el técnico abre la ficha desde su
visita.

### El seguimiento de contacto estaba a medias, y era vital

`contactado`, `fecha_contacto` y `via_whatsapp` existían en la tabla, la API las
aceptaba y **ninguna pantalla las enviaba ni las mostraba**. `contactado`
aparecía en dos archivos y en los dos era solo una línea declarando el tipo.

El cliente lo señaló como vital, y con razón: llega el mes de la visita, alguien
de oficina llama para cuadrar el día, y eso hay que apuntarlo. Sin ello a la
semana siguiente nadie sabe a quién se avisó — o se llama dos veces o no se
llama, y el técnico se planta en una casa donde no le esperan, a veces después
de coger un barco.

Se terminó: bloque de aviso en la visita y filtro **«Sin avisar»** en la lista,
que es la cola de trabajo de la oficina. La fecha se toma en hora local, no con
`toISOString()`: Canarias va por delante de UTC en verano y entre medianoche y la
una se guardaría un día de menos.

### Lo que la auditoría descartó, que también es información

- **El import de Excel resiste el peor escenario.** `conSesionRLS` lo envuelve
  en una transacción, así que un fallo a mitad deshace las inserciones enteras.
  Los duplicados dentro del archivo se rechazan antes de escribir.
- **La interpolación en `SET LOCAL` no es explotable.** Las validaciones previas
  están ancladas y los datos vienen de un JWT firmado. Es la decisión correcta,
  porque `SET LOCAL` no admite parámetros preparados.
- **Las 6 vulnerabilidades de dependencias son inalcanzables.** `uuid` afecta a
  v3, v5 y v6 con búfer; `exceljs` solo usa `v4`, sin búfer. La cadena
  `esbuild → drizzle-kit` es de desarrollo. Ninguna justifica el `--force` que
  propone npm, que degradaría las dos librerías.
- **No hay secretos en el historial de git.** Revisados todos los commits.
