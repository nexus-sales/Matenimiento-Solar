-- Row Level Security
--
-- NOTA sobre los nombres de las políticas: varias siguen llamándose
-- `mantenimientos_*` y `checklist_item_*` aunque sus tablas se llamen ahora
-- `intervenciones` y `plantilla_campo`. Es deliberado: esas políticas ya
-- existen con ese nombre en producción, y renombrarlas aquí haría que una
-- instalación nueva tuviera nombres distintos a los de producción — una
-- divergencia que confunde más al depurar que un prefijo desactualizado.
-- Se aplica DESPUÉS de que drizzle-kit haya creado las tablas (drizzle-kit no gestiona RLS).
-- Ejecutar manualmente: psql $DATABASE_URL -f src/db/rls.sql

-- ---------------------------------------------------------------------
-- Rol de servicio para el login (requiere superusuario, una sola vez):
--
--   CREATE ROLE app_auth_service LOGIN PASSWORD '<contraseña fuerte>' BYPASSRLS;
--   GRANT SELECT (id, email, nombre, password_hash, rol, activo) ON usuarios TO app_auth_service;
--
-- Usar esa credencial como DATABASE_URL_AUTH_SERVICE en el .env — es la
-- única conexión de toda la app que se salta RLS, y solo puede LEER (ni
-- siquiera escribir) seis columnas de una tabla. Todo lo demás pasa
-- siempre por el rol normal, sujeto a las políticas de abajo.
--
-- `nombre` está en la lista porque la sesión lo lleva para mostrarlo en la
-- barra lateral. No es un dato sensible: cualquier usuario autenticado
-- puede leer los nombres del resto (ver usuarios_select más abajo).
-- ---------------------------------------------------------------------

-- El backend, al abrir cada conexión/transacción, debe ejecutar:
--   SET LOCAL app.current_user_id = '<uuid del usuario autenticado>';
--   SET LOCAL app.current_user_rol = '<admin|oficina|tecnico>';
-- Ver src/lib/db-context.ts

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE intervenciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantilla_campo ENABLE ROW LEVEL SECURITY;
ALTER TABLE respuestas ENABLE ROW LEVEL SECURITY;
ALTER TABLE observaciones_bloque ENABLE ROW LEVEL SECURITY;
ALTER TABLE respuesta_foto ENABLE ROW LEVEL SECURITY;

-- Usuarios: todo el mundo autenticado puede leer (para ver nombres de técnico asignado, etc.)
-- Solo admin puede insertar/editar/borrar usuarios (altas y bajas).
CREATE POLICY usuarios_select ON usuarios
  FOR SELECT
  USING (current_setting('app.current_user_id', true) IS NOT NULL);

CREATE POLICY usuarios_admin_write ON usuarios
  FOR ALL
  USING (current_setting('app.current_user_rol', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_rol', true) = 'admin');

-- Clientes: admin y oficina tienen acceso completo. La ficha de cliente
-- incluye los datos de su instalación, así que esta es la única política
-- que gobierna quién puede tocarlos.
-- Técnico solo puede leer (necesita el CUPS y la dirección para la visita,
-- pero no da de alta ni corrige fichas).
CREATE POLICY clientes_oficina_admin_all ON clientes
  FOR ALL
  USING (current_setting('app.current_user_rol', true) IN ('admin', 'oficina'))
  WITH CHECK (current_setting('app.current_user_rol', true) IN ('admin', 'oficina'));

CREATE POLICY clientes_tecnico_read ON clientes
  FOR SELECT
  USING (current_setting('app.current_user_rol', true) = 'tecnico');

-- Mantenimientos: admin/oficina ven y gestionan todo.
-- Técnico solo ve y edita las visitas que tiene asignadas a él.
CREATE POLICY mantenimientos_oficina_admin_all ON intervenciones
  FOR ALL
  USING (current_setting('app.current_user_rol', true) IN ('admin', 'oficina'))
  WITH CHECK (current_setting('app.current_user_rol', true) IN ('admin', 'oficina'));

CREATE POLICY mantenimientos_tecnico_propio ON intervenciones
  FOR ALL
  USING (
    current_setting('app.current_user_rol', true) = 'tecnico'
    AND tecnico_id::text = current_setting('app.current_user_id', true)
  )
  WITH CHECK (
    current_setting('app.current_user_rol', true) = 'tecnico'
    AND tecnico_id::text = current_setting('app.current_user_id', true)
  );

-- Catálogo de checklist: todos leen, solo admin edita (fijo + editable, como se acordó).
CREATE POLICY checklist_item_select ON plantilla_campo
  FOR SELECT
  USING (current_setting('app.current_user_id', true) IS NOT NULL);

CREATE POLICY checklist_item_admin_write ON plantilla_campo
  FOR INSERT
  WITH CHECK (current_setting('app.current_user_rol', true) = 'admin');

CREATE POLICY checklist_item_admin_update ON plantilla_campo
  FOR UPDATE
  USING (current_setting('app.current_user_rol', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_rol', true) = 'admin');

-- Respuestas de checklist: siguen la misma regla que su mantenimiento padre.
CREATE POLICY respuesta_oficina_admin_all ON respuestas
  FOR ALL
  USING (current_setting('app.current_user_rol', true) IN ('admin', 'oficina'))
  WITH CHECK (current_setting('app.current_user_rol', true) IN ('admin', 'oficina'));

CREATE POLICY respuesta_tecnico_propio ON respuestas
  FOR ALL
  USING (
    current_setting('app.current_user_rol', true) = 'tecnico'
    AND EXISTS (
      SELECT 1 FROM intervenciones m
      WHERE m.id = respuestas.intervencion_id
        AND m.tecnico_id::text = current_setting('app.current_user_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.current_user_rol', true) = 'tecnico'
    AND EXISTS (
      SELECT 1 FROM intervenciones m
      WHERE m.id = respuestas.intervencion_id
        AND m.tecnico_id::text = current_setting('app.current_user_id', true)
    )
  );

-- Observaciones de bloque y fotos: siguen la misma regla que la visita a la
-- que pertenecen. Sin esto quedarían legibles para cualquier técnico, que
-- es justo lo que las políticas de arriba evitan para el resto de la visita.
CREATE POLICY observacion_bloque_oficina_admin_all ON observaciones_bloque
  FOR ALL
  USING (current_setting('app.current_user_rol', true) IN ('admin', 'oficina'))
  WITH CHECK (current_setting('app.current_user_rol', true) IN ('admin', 'oficina'));

CREATE POLICY observacion_bloque_tecnico_propio ON observaciones_bloque
  FOR ALL
  USING (
    current_setting('app.current_user_rol', true) = 'tecnico'
    AND EXISTS (
      SELECT 1 FROM intervenciones m
      WHERE m.id = observaciones_bloque.intervencion_id
        AND m.tecnico_id::text = current_setting('app.current_user_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.current_user_rol', true) = 'tecnico'
    AND EXISTS (
      SELECT 1 FROM intervenciones m
      WHERE m.id = observaciones_bloque.intervencion_id
        AND m.tecnico_id::text = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY foto_oficina_admin_all ON respuesta_foto
  FOR ALL
  USING (current_setting('app.current_user_rol', true) IN ('admin', 'oficina'))
  WITH CHECK (current_setting('app.current_user_rol', true) IN ('admin', 'oficina'));

CREATE POLICY foto_tecnico_propio ON respuesta_foto
  FOR ALL
  USING (
    current_setting('app.current_user_rol', true) = 'tecnico'
    AND EXISTS (
      SELECT 1
      FROM respuestas r
      JOIN intervenciones m ON m.id = r.intervencion_id
      WHERE r.id = respuesta_foto.respuesta_id
        AND m.tecnico_id::text = current_setting('app.current_user_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.current_user_rol', true) = 'tecnico'
    AND EXISTS (
      SELECT 1
      FROM respuestas r
      JOIN intervenciones m ON m.id = r.intervencion_id
      WHERE r.id = respuesta_foto.respuesta_id
        AND m.tecnico_id::text = current_setting('app.current_user_id', true)
    )
  );
