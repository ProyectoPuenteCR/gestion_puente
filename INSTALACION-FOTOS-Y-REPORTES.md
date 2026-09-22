# Fotos y reporte histórico por integrante

## Configuración única en Google

1. En el mismo proyecto de Google Cloud usado por la plataforma, habilitá **Google Drive API**.
2. Creá en Google Drive una carpeta llamada `fotos`.
3. Compartila como **Editor** con el correo definido en `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
4. Copiá el ID de la carpeta desde su URL y agregalo en Vercel:

   `GOOGLE_DRIVE_PHOTOS_FOLDER_ID=ID_DE_LA_CARPETA`

5. Volvé a desplegar el proyecto.

La aplicación agrega y utiliza automáticamente la columna **AE — Foto** de la hoja `Integrantes`. Allí se guarda únicamente el identificador privado del archivo; las imágenes no quedan públicas y se entregan sólo a usuarios autorizados de la plataforma.

## Uso

- En **Integrantes → Agregar/Modificar**, usá **Sacar foto** para abrir la cámara o **Subir imagen** para elegir una foto o captura de pantalla. Se aceptan imágenes de hasta 5 MB.
- En **Integrantes**, seleccioná el integrante, presioná **Modificar** y dentro del formulario usá **Reporte completo**.
- El reporte comienza con la foto y todos los datos personales cargados. Luego reúne todos los años con datos e incluye asistencias, faltas, porcentaje, cuotas, scoring, observaciones y comentarios.
- Se abrirá el diálogo de impresión del navegador. Elegí **Guardar como PDF** para descargarlo.
