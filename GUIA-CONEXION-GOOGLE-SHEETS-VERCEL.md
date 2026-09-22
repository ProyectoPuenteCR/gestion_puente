# Proyecto Puente: conexión Google Sheets + Vercel

La aplicación lee la planilla desde el servidor. La clave privada nunca se envía al navegador y la hoja no debe publicarse en Internet.

## Configuración utilizada en este proyecto

- Hoja: `INTEGRANTES 2026`
- ID: `1MAE9EWvZ0TwmTmmdmhfPimfiv8DoXf5pgYOxC7fv_j4`
- Cuenta de servicio: `app-asistencia@secret-timing-351500.iam.gserviceaccount.com`
- Acceso de la aplicación: lectura y escritura. La cuenta de servicio debe conservar permiso de **Editor**.

La clave JSON no está incluida en este proyecto, en el ZIP ni en Git. Se reutiliza temporalmente la clave existente y se rota solo después de verificar la aplicación en producción.

## 1. Preparar la planilla

La versión actual utiliza estas pestañas:

- `Integrantes`
- `Asistencia`
- `cumpleaños`
- `scoring`
- `Configuracion`
- `Usuarios`
- `Baja`
- `LOG`
- `Desempeños`

La aplicación usa `Integrantes` como padrón principal, `Asistencia` para el historial y `scoring` para calificaciones y observaciones. `Configuracion` alimenta los combos y define las pantallas visibles para usuarios comunes; `Usuarios` controla roles y accesos; `Baja` conserva las filas dadas de baja; `Desempeños` guarda comentarios de seguimiento; y `LOG` registra los cambios. No cambies los nombres ni el orden de las columnas creadas por la aplicación.

El ID de la planilla está en la URL:

```text
https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit
```

## 2. Reutilizar la cuenta de servicio existente

Para esta instalación no es necesario crear otra cuenta ni otra clave antes del primer despliegue.

1. En Google Cloud Console selecciona el proyecto `secret-timing-351500`.
2. Confirma que **Google Sheets API** esté habilitada.
3. Conserva el JSON actual únicamente en un lugar privado; no lo copies dentro de la carpeta del proyecto.

Si se instala el sistema desde cero en el futuro, el procedimiento para crear una cuenta nueva es:

1. Ingresa a Google Cloud Console y crea o selecciona un proyecto.
2. Ve a **APIs y servicios > Biblioteca**.
3. Busca **Google Sheets API** y pulsa **Habilitar**.
4. Ve a **IAM y administración > Cuentas de servicio**.
5. Crea una cuenta, por ejemplo `proyecto-puente-vercel`.
6. Abre la cuenta creada y entra en **Claves**.
7. Selecciona **Agregar clave > Crear clave nueva > JSON**.
8. Guarda el archivo JSON en un lugar seguro. No lo subas al proyecto ni a GitHub.

## 3. Dar acceso a la hoja

1. Dentro del JSON copia el valor `client_email`.
2. Abre la planilla de Google Sheets y pulsa **Compartir**.
3. Agrega ese correo como **Editor**. Las altas, modificaciones, bajas, roles y configuraciones se guardan desde el servidor.
4. No cambies la opción general de la hoja a pública.

No hace falta publicar la hoja. La aplicación escribe utilizando exclusivamente la cuenta de servicio.

## 4. Preparar la clave privada

La forma más segura para evitar problemas con saltos de línea es convertir solamente el valor `private_key` del JSON a Base64.

En PowerShell:

```powershell
$json = Get-Content .\cuenta-servicio.json -Raw | ConvertFrom-Json
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json.private_key))
```

Copia el resultado. Ese valor se cargará como `GOOGLE_PRIVATE_KEY_BASE64`.

## 5. Subir el proyecto a la cuenta correcta de Vercel

Opción recomendada:

1. Sube esta carpeta a un repositorio privado de GitHub.
2. En Vercel selecciona **Add New > Project**.
3. Importa el repositorio.
4. Vercel detectará Next.js y utilizará `npm run build:vercel`.
5. Antes de desplegar, agrega las variables indicadas abajo.

También puedes ejecutar `vercel` dentro de esta carpeta si utilizas Vercel CLI.

Si Vercel responde `403` o indica que no tienes permiso para crear el despliegue, la conexión está asociada a una cuenta o equipo sin acceso de escritura. En ese caso, vuelve a conectar Vercel seleccionando el equipo propietario del proyecto o importa el ZIP manualmente desde esa cuenta. El código no necesita cambios.

## 6. Crear el acceso con Google

El acceso usa OAuth de Google. No utiliza la clave JSON de la cuenta de servicio: son credenciales distintas.

1. En Google Cloud Console selecciona el proyecto que administrará el acceso.
2. Ve a **APIs y servicios > Pantalla de consentimiento OAuth**.
3. Configura la aplicación como **Interna** para el dominio `proyecto-puente.org`.
4. Ve a **Credenciales > Crear credenciales > ID de cliente OAuth**.
5. Selecciona **Aplicación web**.
6. En **Orígenes de JavaScript autorizados** agrega la URL de producción de Vercel.
7. En **URI de redireccionamiento autorizados** agrega:

```text
https://TU-PROYECTO.vercel.app/api/auth/callback/google
```

8. Copia el ID y el secreto del cliente. Se cargarán como `AUTH_GOOGLE_ID` y `AUTH_GOOGLE_SECRET`.

El sistema verifica además que Google marque el correo como verificado y que su dominio sea exactamente `proyecto-puente.org`. Después consulta la pestaña `Usuarios`: el correo debe estar activo y su rol puede ser `usuario` o `admin`. `brechasdigitales@proyecto-puente.org` queda como administrador inicial y de recuperación.

## 7. Variables de entorno en Vercel

En **Project Settings > Environment Variables**, agrega para Production, Preview y Development:

| Variable | Valor |
| --- | --- |
| `GOOGLE_SHEET_ID` | ID obtenido de la URL de la hoja |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Valor `client_email` del JSON |
| `GOOGLE_PRIVATE_KEY_BASE64` | Clave privada convertida a Base64 |
| `AUTH_GOOGLE_ID` | ID del cliente OAuth de Google |
| `AUTH_GOOGLE_SECRET` | Secreto del cliente OAuth de Google |
| `AUTH_SECRET` | Cadena aleatoria larga para firmar las sesiones |
| `AUTH_ALLOWED_DOMAIN` | `proyecto-puente.org` |
| `AUTH_ADMIN_EMAILS` | `brechasdigitales@proyecto-puente.org` |

Después de cargarlas, abre **Deployments**, entra al último despliegue y elige **Redeploy**.

No cargues el JSON completo como archivo. Extrae solo `client_email` y `private_key`, y guarda la clave privada codificada en Base64.

Para generar `AUTH_SECRET` en PowerShell:

```powershell
$bytes = New-Object byte[] 48
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

## 8. Verificación

1. Abre la URL de Vercel.
2. Inicia sesión con una cuenta `@proyecto-puente.org`.
3. Confirma que una cuenta normal muestre el rol **Usuario**, vea una sola ficha y no tenga los menús **Configuración** ni **Administración**.
4. Ingresa con `brechasdigitales@proyecto-puente.org` y confirma el rol **Administrador**.
5. Ve a **Administración** y verifica que aparezcan los nombres y `email-puente` de la pestaña `Usuarios`.
6. Ve a **Configuración** y confirma las opciones de horarios, títulos, actividades y tareas.
7. Abre **Integrantes**, prueba el selector de columnas y verifica que el total coincida con la pestaña `Integrantes`.
8. Realiza una modificación controlada y confirma que aparezca en `LOG`.
9. En `Configuración → Pantallas de usuarios`, activa o desactiva una pantalla y comprueba el menú con una cuenta de rol `usuario`.
10. En `Scoring`, modifica una calificación de prueba y verifica la misma celda en la pestaña `scoring`.
11. En `Desempeños`, guarda un comentario y verifica que aparezca en la pestaña `Desempeños`.

Si aparece el modo demostración, falta alguna variable. Si la pantalla informa que la hoja no está compartida o no permite edición, revisa el ID y confirma que `client_email` tenga permiso de editor.

## Seguridad

- No publiques la hoja.
- No uses una API key en el navegador.
- No subas el JSON de Google al repositorio.
- Utiliza un repositorio privado.
- Mantén `AUTH_GOOGLE_SECRET` y `AUTH_SECRET` únicamente en las variables privadas de Vercel.
- El dominio se valida en el servidor; el parámetro visual de Google no se usa como única protección.
- Los usuarios comunes sólo reciben su propia fila; esta restricción se valida nuevamente en cada API del servidor.
- Las contraseñas pertenecen a Google y nunca se guardan en la hoja ni en la aplicación.

## Rotar la clave después de verificar producción

No borres todavía la clave actual: también puede estar siendo utilizada por la aplicación anterior.

1. Crea una clave JSON nueva en la misma cuenta de servicio.
2. Convierte su `private_key` a Base64.
3. Sustituye `GOOGLE_PRIVATE_KEY_BASE64` en Vercel y vuelve a desplegar.
4. Comprueba que **Administración** indique `Google Sheets conectado` y que los integrantes y asistencias sean reales.
5. Actualiza también la otra aplicación si usa la clave anterior.
6. Solo después de validar ambas aplicaciones, elimina exclusivamente la clave antigua desde Google Cloud.
