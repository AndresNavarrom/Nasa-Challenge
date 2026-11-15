# Captura de intención — Preguntas (paso 12: planeta, transición y mapa)

## Sources

- [desc] Initial description: "Construir el paso 12 del plan de la Jukebox Terrestre para Samuel, en la rama interfaz: planeta 3D que gira con la textura de la capa activa, transición a la Amazonía (giro y aplanado, ida y vuelta en 2 segundos o menos), mapa regional de la Amazonía, y el punto bajo el cursor convertido en longitud y latitud para alimentar el sonido. Debe estar funcionando con la capa del bosque antes de las 11:00 p.m. de hoy, cuando se decide si se mantiene el planeta o se pasa al plan B."
- [scope] Workflow-selected scope: `poc`.

## Q1. [Producto] Lo que este paso hereda del trabajo ya aprobado

Este paso es el Step 12 del plan de código aprobado en el trabajo anterior (`261114-earth-jukebox-poc`). Para no volver a preguntar lo ya decidido, confirma que esto sigue valiendo:

- **Para quién**: público general y jurado del NASA Space Apps Challenge; la historia es la Amazonía como pulmón del mundo.
- **Qué significa "listo" hoy**: a las 11:00 p.m. se ve el bosque en el planeta y en el mapa de la Amazonía, la transición de ida y vuelta tarda 2 segundos o menos, y se decide si se mantiene el planeta.
- **Plan B si no corre fluido** (menos de 30 cuadros por segundo): primero texturas más pequeñas; si no basta, planeta fijo sin giro libre y cambio directo al mapa, sin animación de aplanado.
- **Datos disponibles**: solo el bosque tiene cobertura global; el humo y el CO2 existen únicamente sobre la Amazonía.
- **Fuera de este paso**: el panel lateral, la línea de tiempo, el modo historia y la accesibilidad (pasos 13 y 14, también de Samuel), y el motor de sonido (paso 10, de Fernando). Este paso solo entrega la longitud y la latitud del punto bajo el cursor para que el sonido las use.

A. All correct
B. Some need changing (say which and how)
C. Not yet defined
X. Other (please specify)

[Answer]: X. Hay que teneer encuenta el tema de los datos dado que fernando entrego mas datos, y nos sumistro informacion que nos puede ayudar a mejorar el planeta en 3d y en sus capas, para esto realiza una consulta del estado actual de la rama y espera a que se realiza la pr por parte de fernando para validarlo

## Q2. [Datos] ¿Cómo seguimos con la PR de Fernando?

En la respuesta a Q1 pediste revisar la rama de Fernando y esperar su PR para validarla. La PR ya existe: la #1, "Add GEOS-FP scraping tools and Docker build docs", abierta a las 5:15 p.m. desde `datos-rust`, con su último commit a las 5:21 p.m. No trae datos nuevos dentro del repositorio: trae scripts para descargar datos de GEOS-FP y GISTEMP. Si los datos que entregó Fernando están en otro lugar, hace falta saber dónde.

A. Validarla ya: la PR está abierta
B. Esperar a que Fernando avise que la terminó
C. Los datos que entregó están en otro lugar (indica dónde)
D. Not yet defined
X. Other (please specify)

[Answer]: A

## Q3. [Producto] ¿El paso 12 usa los datos de GEOS-FP hoy?

La validación de la PR #1 (respuesta a Q2) mostró que GEOS-FP publica aerosoles para todo el planeta cada 3 horas, lo que permitiría ver y oír el humo en todo el globo. Pero cada archivo pesa unos 107 MB, viene en NetCDF, y falta descargarlo y convertirlo al formato de la app. Lo que se haga hoy compite con tener el planeta y la transición listos a las 11:00 p.m.

A. El paso 12 sigue con los datos actuales (bosque global); GEOS-FP pasa a una tarea aparte para mañana (Recommended)
B. Incorporar ya al paso 12 una capa global de aerosoles de GEOS-FP
C. Not yet defined
X. Other (please specify)

[Answer]: B

## Assumption Confirmation

Estas suposiciones vienen del trabajo aprobado anterior y no se confirmaron en Q1:

- El público es el general y el jurado, y la historia sigue siendo la Amazonía como pulmón del mundo.
- El plan B si no se llega a 30 cuadros por segundo: primero texturas más pequeñas; si no basta, planeta fijo sin giro libre y cambio directo al mapa, sin aplanado animado.
- Quedan fuera de este paso el panel lateral, la línea de tiempo, el modo historia y la accesibilidad (pasos 13 y 14) y el motor de sonido (paso 10, de Fernando).
- La conversión de los datos de GEOS-FP se hace en contenedor de Docker, por la regla del proyecto, aunque los scripts de Fernando usan Nix.

A. Accept assumptions
B. Convert to follow-up questions

[Answer]: B. Convert to follow-up questions

## Q4. [Producto] ¿Para quién y con qué historia es el planeta?

Viene de la primera suposición: el trabajo anterior definió el público y la historia; hace falta confirmarlo para este paso.

A. Público general y jurado; la historia es la Amazonía como pulmón del mundo
B. Cambia el público o la historia (di cómo)
C. Not yet defined
X. Other (please specify)

[Answer]: A

## Q5. [Interfaz] ¿Cuál es el plan B si el planeta no llega a 30 cuadros por segundo?

Viene de la segunda suposición; define qué se hace si la decisión de las 11:00 p.m. sale mal.

A. Primero texturas más pequeñas; si no basta, planeta fijo sin giro libre y cambio directo al mapa, sin aplanado animado
B. Otro plan B (di cuál)
C. Not yet defined
X. Other (please specify)

[Answer]: A

## Q6. [Producto] ¿Qué queda fuera de este paso? (select all that apply)

Viene de la tercera suposición; marca lo que no se construye en el paso 12.

A. Panel lateral y línea de tiempo (paso 13)
B. Modo historia y pantalla de inicio (paso 13)
C. Accesibilidad con teclado y lector de pantalla (paso 14)
D. Motor de sonido (paso 10, de Fernando); este paso solo entrega longitud y latitud
X. Other (please specify)

[Answer]: A, B, C, D

## Q7. [Datos] ¿Dónde se convierten los datos de GEOS-FP?

Viene de la cuarta suposición: la regla del proyecto es que todo corre en Docker, pero los scripts de Fernando usan Nix.

A. En un contenedor de Docker, como el resto del proyecto
B. Con Nix, como los scripts de Fernando
C. Not yet defined
X. Other (please specify)

[Answer]: A
