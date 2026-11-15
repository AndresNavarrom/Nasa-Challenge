# Captura de intención — Preguntas (mejora de resolución del planeta y las capas)

## Sources

- [desc] Initial description: "Mejorar la resolución del planeta y de las capas de la Jukebox Terrestre con datos reales: imagen base del planeta de Natural Earth 10m en alta resolución (8192x4096 para el globo y un recorte de alta resolución para el mapa de la Amazonía); capa de humo con PM2.5 global de GEOS-CF v2 (aqc_tavg_1hr_glo_L1440x721_slv, 0,25 grados, 1 de septiembre de 2026) en lugar de los cuadros del video de SVS 5533; reemplazar la capa de CO2 por una capa de rayos con el video para esfera de SVS 5011 (iss_lightning_sos_yearly_07312023_2048p60.mp4, 4096x2048 equirectangular); y subir las cuadrículas globales a 1440x720. La conversión corre en Docker. El bosque GEDI L3 queda pendiente de una cuenta de Earthdata."
- [scope] Workflow-selected scope: `poc`.

## Q1. [Producto] ¿Qué versión de la imagen base de Natural Earth usa el planeta?

Natural Earth 10m tiene una versión en grises (la que pasaste) y otra a color con relieve. El gris hace resaltar las capas encima; el color se ve más natural pero compite con ellas.

A. En grises (Gray Earth), para que las capas resalten
B. A color con relieve (Natural Earth I)
C. Not yet defined
X. Other (please specify)

[Answer]: B

## Q2. [Datos] ¿El humo de GEOS-CF reemplaza la capa de carbono negro de GEOS-FP que se le pidió a Andres?

En el paso 12 se le encargó a Andres una capa `aerosol` con carbono negro de GEOS-FP. El PM2.5 de GEOS-CF cubre lo mismo (humo en todo el planeta), pesa unas 16 veces menos por instante y viene de la misma fuente de modelos de la NASA.

A. Sí: el humo de GEOS-CF reemplaza esa capa y se cancela el encargo de GEOS-FP
B. No: se mantienen las dos capas
C. Not yet defined
X. Other (please specify)

[Answer]: A

## Q3. [Equipo] ¿Quién convierte los datos y cambia el formato (CO2 por rayos)?

Cambiar el CO2 por rayos cambia la lista de capas en `web/src/data/types.ts` y `tools/prep/src/config.rs`, y la preparación de datos vive en carpetas de Andres según `TAREAS.md`.

A. Lo hago yo ahora en la rama `interfaz`, y aviso a Andres y Fernando antes de unir a `main`
B. Se lo paso a Andres
C. Not yet defined
X. Other (please specify)

[Answer]: A

## Q4. [Producto] ¿Cómo se muestran los rayos en el tiempo?

El video para esfera de SVS 5011 acumula los rayos detectados desde la Estación Espacial entre 2017 y 2023.

A. Un instante por año, de 2017 a 2023 (7 instantes que avanzan en la línea de tiempo)
B. Un solo mapa con todo el periodo acumulado
C. Not yet defined
X. Other (please specify)

[Answer]: B

## Q5. [Producto] ¿Qué queda fuera de este trabajo? (select all that apply)

Marca lo que no se hace ahora y pasa a después.

A. El bosque con datos GEDI L3 (necesita una cuenta de Earthdata)
B. Recortar el CO2 por completo de la app (archivos y textos)
C. Cambios en el motor de sonido para la capa de rayos
D. None
X. Other (please specify)

[Answer]: C

## Q6. [Datos] ¿Cómo entra el bosque con GEDI L3?

En Q5 no marcaste el bosque GEDI L3 como fuera de alcance, pero la descripción decía que quedaba pendiente de una cuenta de Earthdata. Descargar GEDI L3 exige iniciar sesión con una cuenta gratuita de NASA Earthdata, y yo no puedo usar credenciales de nadie.

A. Alguien del equipo crea la cuenta ahora, descarga el archivo de GEDI L3 y lo deja en `data/raw/`; yo hago la conversión
B. Queda fuera de este trabajo, como decía la descripción; el bosque sigue con los datos actuales
C. Mientras tanto, mejorar el bosque con los cuadros en 4K del video de SVS 4950
D. Not yet defined
X. Other (please specify)

[Answer]: C

## Consolidated Summary Confirmation

- La imagen base del planeta es Natural Earth 10m a color con relieve (Natural Earth I) (Q1).
- El humo pasa a PM2.5 global de GEOS-CF y reemplaza la capa de carbono negro de GEOS-FP que se le había pedido a Andres; ese encargo se cancela (Q2).
- La conversión de datos y el cambio del formato (CO2 por rayos) los hace Samuel ahora en la rama `interfaz`, avisando a Andres y Fernando antes de unir a `main` (Q3).
- Los rayos se muestran como un solo mapa con todo el periodo acumulado, 2017 a 2023 (Q4).
- Queda fuera de este trabajo ajustar el motor de sonido para la capa de rayos (Q5).
- El bosque se mejora con los cuadros en 4K del video de SVS 4950 en vez de GEDI L3 (Q6).

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
