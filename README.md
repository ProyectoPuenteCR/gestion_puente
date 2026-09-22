# Proyecto Puente — panel de gestión

Panel privado en Next.js para administrar la hoja `INTEGRANTES 2026` desde Vercel mediante una cuenta de servicio de Google.

## Funciones

- Resumen de integrantes activos, asistencia, cumpleaños y turnos.
- ABM completo de integrantes con las 30 columnas reales de la hoja.
- Selector de columnas visibles y búsqueda en toda la grilla.
- Formularios con horario, títulos, actividades y tareas configurables.
- Fecha de nacimiento con calendario, edad y mayoría de edad calculadas.
- Calendario general de cumpleaños visible para todos, sin exponer el año de nacimiento ni la edad a usuarios comunes.
- Permiso administrativo para habilitar o bloquear la edición de la ficha propia de los usuarios; desactivado por defecto y validado en el servidor.
- Saludo automático y personalizado por correo, copia configurable y sincronización anual con Google Calendar.
- Baja con traslado de la fila a la pestaña `Baja`.
- Administración de usuarios, roles y acceso desde la pestaña `Usuarios`.
- Perfil `Capacitador`: acceso exclusivo a Scoring con permisos para consultar, calificar y exportar notas.
- Registro de altas, modificaciones, bajas, roles y configuraciones en `LOG`.
- Permiso administrativo para habilitar o bloquear la edición de la ficha propia de los usuarios; bloqueado por defecto y validado también en el servidor.
- Historial de asistencia y exportación CSV.
- Calendario de asistencia con años, meses, rankings y detalle ordenable por columna.
- Scoring anual editable por administradores, con temas configurables, filtro por mes/año, promedio automático y detalle por doble clic.
- Historial normalizado en `Scoring Historial`; la pestaña `scoring` anterior se conserva como respaldo y cada cambio se audita en `LOG`.
- Pantalla `Desempeños` exclusiva de administradores con asistencia, inasistencia, scoring, comentarios y listado anual de notas de todos los integrantes.
- Selección desde `Configuración` de las pantallas visibles para usuarios comunes.
- Acceso con Google restringido a cuentas `@proyecto-puente.org`.
- Roles: los usuarios sólo consultan su información autorizada y modifican su propia ficha; los capacitadores acceden únicamente a Scoring; los administradores conservan acceso completo.
- Lectura y escritura de Google Sheets únicamente desde el servidor, sin exponer la clave al navegador.

## Desarrollo

Requiere Node.js 22 o superior.

```bash
npm ci
cp .env.example .env.local
npm run dev:vercel
```

Para verificar la versión de producción:

```bash
npm run lint
npm run build:vercel
```

## Variables de entorno

Configura en Vercel:

- `GOOGLE_SHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY_BASE64`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `RESEND_API_KEY`
- `BIRTHDAY_FROM_EMAIL`
- `CRON_SECRET`
- `AUTH_SECRET`
- `AUTH_ALLOWED_DOMAIN`
- `AUTH_ADMIN_EMAILS`

Consulta `GUIA-CONEXION-GOOGLE-SHEETS-VERCEL.md` para el procedimiento completo y la rotación segura de la clave.

Para activar los cumpleaños automáticos, verificá `proyecto-puente.org` en Resend, compartí el calendario configurado con `GOOGLE_SERVICE_ACCOUNT_EMAIL` otorgando permiso para modificar eventos y habilitá Google Calendar API en el proyecto de Google Cloud. El cron se ejecuta a las 12:00 UTC, equivalentes a las 09:00 de Argentina.

El archivo JSON de Google nunca debe guardarse dentro del repositorio ni del ZIP.
