# Análisis de requisitos — Preguntas (bosque con GEDI L3)

Contexto: la intención aprobada y el mapa del código fijan casi todo. Comprobé en el catálogo de la NASA (CMR) que existe el archivo `GEDI03_rh100_mean_2019108_2025190_003_01.tif` de la Versión 3. Pesa unos 617 MB y se baja de `data.ornldaac.earthdata.nasa.gov/protected/...`, que pide la cuenta de Earthdata. Estas dos preguntas cierran lo que no se puede decidir sin ti.

## Q1. [Datos] ¿Qué muestra el bosque en las celdas, dentro de la franja de GEDI, donde GEDI no tiene medición?

A 1 km, GEDI deja huecos entre las pasadas de la Estación Espacial. Al pasar a la cuadrícula de la app (0,25° en el globo y 0,1° en la Amazonía) se promedian los píxeles con dato, y casi todos los huecos se llenan, pero puede quedar alguna celda sin ninguna medición.

A. Esas celdas se completan con el valor de SVS 4950, igual que fuera de la franja
B. Esas celdas quedan en 0 (sin bosque)
C. Not yet defined
X. Other (please specify)

[Answer]: A

## Q2. [Datos] ¿Con qué escala se convierte la altura del dosel?

La capa actual usa la barra de SVS 4950, de 0 a 50 m. El relleno fuera de ±52° sale de esa misma barra.

A. De 0 a 50 m, lineal, recortando lo que pase de 50 m, igual que la barra actual, para que GEDI y el relleno coincidan
B. De 0 al máximo que traiga el archivo
C. Not yet defined
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- El bosque sale de `GEDI03_rh100_mean_2019108_2025190_003_01.tif` (GEDI L3 Versión 3), descargado con la cuenta de Earthdata desde `~/.netrc` en solo lectura (intención).
- Toda celda sin medición de GEDI, dentro o fuera de la franja de unos 52°, se completa con el valor de SVS 4950 (Q1; Q3 de la intención).
- La altura se convierte de 0 a 50 m de forma lineal, y lo que pase de 50 m queda en el tope, igual que la barra de SVS 4950 (Q2).
- Cuadrícula global de 1440 × 720 y regional de la Amazonía de 360 × 280 (intención).
- Quedan fuera el motor de sonido y GEDI L4B; la revisión en el navegador va primero (intención).

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
