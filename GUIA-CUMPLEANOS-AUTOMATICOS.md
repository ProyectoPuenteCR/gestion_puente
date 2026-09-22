# Cumpleaños automáticos — Proyecto Puente

## Qué hace la función

- Muestra a todos los usuarios el nombre, día y mes de cumpleaños de los integrantes actuales.
- Mantiene el año de nacimiento y la edad visibles únicamente para administradores.
- Envía el saludo al campo `email-puente` del integrante y una copia a la casilla configurada.
- Crea un evento anual de día completo en Google Calendar sin publicar el año real de nacimiento.
- Ejecuta la revisión todos los días a las 09:00 de Argentina mediante Vercel Cron.

## 1. Configurar Resend

1. En Vercel, abrí el proyecto y agregá la integración **Resend** desde Marketplace.
2. En Resend verificá el dominio `proyecto-puente.org` agregando los registros DNS solicitados.
3. Confirmá que Vercel tenga la variable `RESEND_API_KEY`.
4. Agregá `BIRTHDAY_FROM_EMAIL` con un remitente del dominio verificado, por ejemplo:

   `Proyecto Puente <cumpleanios@proyecto-puente.org>`

## 2. Proteger la tarea automática

Agregá en Vercel una variable `CRON_SECRET` con una cadena aleatoria extensa. Debe cargarse solamente como variable privada del proyecto; nunca debe subirse al repositorio.

## 3. Habilitar Google Calendar

1. En el mismo proyecto de Google Cloud utilizado por la cuenta de servicio, habilitá **Google Calendar API**.
2. Copiá el valor de `GOOGLE_SERVICE_ACCOUNT_EMAIL` desde Vercel.
3. Abrí Google Calendar con `brechasdigitales@proyecto-puente.org`.
4. Entrá en **Configuración y uso compartido** del calendario.
5. En **Compartir con personas o grupos específicos**, agregá la cuenta de servicio.
6. Otorgale permiso **Realizar cambios en eventos**.

## 4. Activar desde la plataforma

1. Ingresá como administrador.
2. Abrí **Configuración → Saludos de cumpleaños**.
3. Indicá la casilla que recibirá la copia y el calendario de destino.
4. Personalizá el asunto y el mensaje. Se admiten `{{nombre}}` y `{{nombre_completo}}`.
5. Activá **Saludo diario automático** y guardá.
6. Usá **Probar correo** para enviar una prueba solamente a la casilla de copia.
7. Usá **Sincronizar calendario** para crear o actualizar los eventos anuales de todos los integrantes actuales.

Los integrantes trasladados a `Baja` no se incluyen. La sincronización retira del calendario los eventos administrados por la plataforma que ya no correspondan a integrantes actuales. Las altas nuevas aparecerán en la siguiente sincronización diaria.
