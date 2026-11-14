# Análisis de requisitos — Preguntas (paso 12)

Contexto: la intención aprobada (`intent-statement.md`) y el mapa del código (`aidlc/spaces/default/codekb/Nasa-Challenge/`) ya fijan casi todo. Estas preguntas resuelven los tres puntos que dejó abiertos la revisión de la intención y lo que encontró la revisión del código: sumar la capa de aerosoles cambia el formato de datos.

## Q1. [Producto] ¿Qué pasa si la capa de aerosoles no está lista a las 11:00 p.m.?

La revisión de la intención señaló que no se dijo qué tiene prioridad. La decisión de las 11:00 p.m. (mantener el planeta o pasar al plan B) depende del bosque, la transición y el cursor.

A. El bosque, la transición y el cursor van primero; los aerosoles no bloquean la decisión de las 11:00 p.m. y se terminan después si hace falta (Recommended)
B. Los aerosoles son obligatorios para la decisión de las 11:00 p.m.
C. Not yet defined
X. Other (please specify)

[Answer]: A

## Q2. [Datos] ¿Qué dato de aerosoles muestra el planeta, y de qué fecha?

GEOS-FP publica aerosoles para todo el planeta cada 3 horas (unos 107 MB por instante). Comprobé que hay datos del 1 de septiembre de 2026, en temporada de incendios en la Amazonía. Para la historia, el carbono negro es lo más ligado al humo de incendios; el espesor óptico total mezcla humo, polvo y sal marina.

A. Carbono negro (humo de incendios) en un solo instante fijo del 1 de septiembre de 2026 (Recommended)
B. Espesor óptico total de aerosoles en un solo instante fijo del 1 de septiembre de 2026
C. Varios instantes de un día (más descargas y más tiempo) para que el humo avance en la línea de tiempo
D. Not yet defined
X. Other (please specify)

[Answer]: C

## Q3. [Producto] ¿Los aerosoles solo se ven, o también le entregan su valor al sonido?

La revisión de la intención señaló que no estaba claro. El motor de sonido es de Fernando, pero si los aerosoles entran como una capa más del archivo de datos, cualquier punto del planeta ya entrega su valor con la función que existe, sin trabajo extra en el sonido.

A. Entran como una capa más del archivo de datos: se ven y entregan su valor a quien construya el sonido (Recommended)
B. Solo una imagen sobre el planeta, sin valor para el sonido
C. Not yet defined
X. Other (please specify)

[Answer]: A

## Q4. [Equipo] ¿Quién toca el formato de datos para sumar la capa nueva?

La revisión del código encontró que los tipos de capa son una lista cerrada repetida en `web/src/data/types.ts` y `tools/prep/src/config.rs`, y la preparación de datos vive en `data/` y `tools/`. Esas carpetas son de Andres Navarro según `TAREAS.md`, que además pide avisar a los tres antes de cambiar el formato de datos.

A. Lo hago yo dentro de este paso, en la rama `interfaz`, y aviso a Fernando y Andres antes de unir a `main` (Recommended)
B. Se lo pido a Andres Navarro y el paso 12 usa la capa cuando él la entregue
C. Not yet defined
X. Other (please specify)

[Answer]: B

## Q5. [Datos] ¿Qué variable de aerosoles usa la capa?

En Q2 elegiste varios instantes de un día, pero esa opción no fijó la variable. Andres la necesita para convertir los datos.

A. Carbono negro (lo más ligado al humo de incendios) (Recommended)
B. Espesor óptico total de aerosoles (humo, polvo y sal marina juntos)
C. Not yet defined
X. Other (please specify)

[Answer]: A

## Q6. [Datos] ¿Cuántos instantes del 1 de septiembre de 2026?

Cada instante pesa unos 107 MB de descarga, aunque el resultado preparado para la app es mucho más liviano. Más instantes dan un movimiento más suave del humo en la línea de tiempo.

A. 4 instantes, cada 6 horas (unos 430 MB de descarga) (Recommended)
B. Los 8 instantes del día, cada 3 horas (unos 860 MB de descarga)
C. Not yet defined
X. Other (please specify)

[Answer]: B
