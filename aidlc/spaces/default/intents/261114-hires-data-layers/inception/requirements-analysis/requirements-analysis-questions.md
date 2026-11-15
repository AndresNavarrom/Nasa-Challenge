# Análisis de requisitos — Preguntas (mejora de resolución)

Contexto: la intención aprobada (`intent-statement.md`) y el mapa del código (`aidlc/spaces/default/codekb/Nasa-Challenge/`) fijan casi todo. Estas preguntas cierran lo que dejó abierto la revisión de la intención (R-01 y R-02) y dos riesgos que encontró la revisión del código. R-03 (GEDI L3 diferido, no descartado) queda registrado directamente en los requisitos.

## Q1. [Datos] ¿Qué se hace con los restos de CO2 en la app?

La revisión del código encontró `co2` en la lista de capas (dos copias), en la preparación de datos, en la rampa de color de la textura, en el color `--color-co2` del CSS y en `co2ToBreath` del motor de sonido. El motor de sonido es de Fernando y quedó fuera de este trabajo.

A. Retirar el CO2 de los datos, la lista de capas, la textura y el CSS; dejar `co2ToBreath` intacto y avisarle a Fernando para que lo cambie por rayos (Recommended)
B. Retirar el CO2 de todas partes, incluido `co2ToBreath`
C. Dejar los archivos de CO2 sin usar y solo agregar los rayos
D. Not yet defined
X. Other (please specify)

[Answer]: C

## Q2. [Datos] ¿Cuántos instantes del 1 de septiembre de 2026 tiene el humo de GEOS-CF?

GEOS-CF publica PM2.5 cada hora; cada archivo pesa unos 6,7 MB de descarga. Ya preparado, cada instante global de 1440 × 720 pesa cerca de 1 MB y la app los descarga todos al arrancar.

A. 8 instantes, cada 3 horas (unos 54 MB de descarga, unos 8 MB en la app) (Recommended)
B. 24 instantes, uno por hora (unos 160 MB de descarga, unos 25 MB en la app)
C. Un solo instante fijo
D. Not yet defined
X. Other (please specify)

[Answer]: B

## Q3. [Datos] ¿A qué resolución quedan las cuadrículas de la Amazonía?

Hoy la región (36 × 28 grados) tiene 96 × 72 celdas, unos 0,375 grados. Las fuentes nuevas dan más detalle: GEOS-CF trae 0,25 grados y los cuadros de 4K del bosque y el video de rayos dan cerca de 0,1 grados.

A. 360 × 280 celdas (0,1 grados) para bosque y rayos; el humo a 144 × 112 (0,25 grados, su resolución real) (Recommended)
B. 144 × 112 celdas (0,25 grados) para las tres capas
C. Not yet defined
X. Other (please specify)

[Answer]: A

## Q4. [Producto] ¿Qué pasa si el portátil de la demo no acepta la imagen de 8192 × 4096?

Algunas tarjetas gráficas de portátil solo aceptan imágenes de hasta 4096 píxeles por lado; con una de 8192 el planeta se vería negro. Hoy el modo `?lite=1` reduce la imagen a la mitad.

A. Preparar también una versión de 4096 × 2048; la app usa la de 8192 si la tarjeta la acepta y la de 4096 si no, y `?lite=1` siempre usa la de 4096 (Recommended)
B. Solo la de 8192; si falla, se usa `?lite=1`, que la reduce
C. Not yet defined
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- El CO2 deja de mostrarse y entra la capa de rayos; los archivos y el código de CO2 se quedan en el repositorio sin usar, incluido `co2ToBreath` (Q1).
- El humo de GEOS-CF tiene los 24 instantes del 1 de septiembre de 2026, uno por hora (Q2).
- En la Amazonía, bosque y rayos quedan a 360 × 280 celdas (0,1 grados) y el humo a 144 × 112 (0,25 grados) (Q3).
- La imagen base se prepara a 8192 × 4096 y también a 4096 × 2048; la app usa la de 8192 si la tarjeta gráfica la acepta, la de 4096 si no, y `?lite=1` usa siempre la de 4096 (Q4).
- Las cuadrículas globales de las tres capas quedan a 1440 × 720 (intención).
- GEDI L3 queda diferido hasta tener una cuenta de Earthdata, no descartado (revisión de la intención, R-03).

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
