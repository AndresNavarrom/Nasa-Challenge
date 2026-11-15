# Captura de intención — Preguntas (bosque con GEDI L3)

## Sources

- [desc] Initial description: "Reemplazar la capa de bosque (forest) de la Jukebox Terrestre por datos reales de GEDI L3 (altura media del dosel en cuadrícula de 1 km, ORNL DAAC) en lugar de los cuadros 4K del video de SVS 4950. La descarga corre en el contenedor de Docker fetch y usa la cuenta de NASA Earthdata del equipo desde ~/.netrc montado en solo lectura, sin que la contraseña entre al repositorio ni a las imágenes. El GeoTIFF se convierte a cuadrícula global de 1440x720 y regional de la Amazonía de 360x280, y se actualizan data/SOURCES.md y la descripción de la capa."
- [scope] Workflow-selected scope: `poc`.

## Q1. [Datos] ¿Qué versión de GEDI L3 usa el bosque?

ORNL DAAC publica dos versiones de "GEDI L3 Gridded Land Surface Metrics". Las dos cubren desde abril de 2019; la Versión 3 llega hasta julio de 2025 y es la más reciente.

A. Versión 3 (la más reciente)
B. Versión 2
C. Not yet defined
X. Other (please specify)

[Answer]: A

## Q2. [Producto] ¿Qué pasa con la capa de bosque actual si GEDI L3 no queda lista antes del congelamiento de las 5:00 p.m.?

Hoy el bosque sale de los cuadros en 4K de SVS 4950 y ya funciona en la rama `interfaz`.

A. Se queda la capa actual de SVS 4950; GEDI L3 entra solo si queda lista y comprobada a tiempo
B. No hay respaldo: el bosque debe salir de GEDI L3
C. Not yet defined
X. Other (please specify)

[Answer]: B

## Q3. [Datos] ¿Qué muestra el bosque fuera de la zona que mide GEDI?

GEDI solo mide entre unos 52 grados de latitud norte y sur, así que el norte de Canadá, Rusia y Escandinavia quedan sin datos.

A. Sin datos (no se ve bosque ahí)
B. Completar esas zonas con los valores actuales de SVS 4950
C. Not yet defined
X. Other (please specify)

[Answer]: B

## Q4. [Equipo] ¿Quién hace el cambio y a quién se avisa?

A. Samuel, en la rama `interfaz`, avisando a Andres y Fernando antes de unir a `main`
B. Otra persona del equipo
C. Not yet defined
X. Other (please specify)

[Answer]: A

## Q5. [Producto] ¿Qué queda fuera de este trabajo? (select all that apply)

A. Cambios en el motor de sonido para la capa de bosque
B. La biomasa de GEDI L4B (otra variable)
C. Mostrar en la app la incertidumbre o la cantidad de mediciones por celda
D. None
X. Other (please specify)

[Answer]: A, B

## Q6. [Producto] ¿Cómo se ordena este trabajo frente a la revisión del planeta en el navegador para la decisión de las 11:00 p.m.?

A. La revisión en el navegador va primero; GEDI L3 no bloquea esa decisión
B. GEDI L3 va primero
C. Not yet defined
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- El bosque usa GEDI L3 Gridded Land Surface Metrics, Versión 3 (abril de 2019 a julio de 2025) (Q1).
- No hay respaldo: la capa de bosque debe salir de GEDI L3 (Q2).
- Fuera de la franja que mide GEDI (unos 52 grados norte y sur), el bosque se completa con los valores actuales de SVS 4950 (Q3).
- Samuel hace el cambio en la rama `interfaz` y avisa a Andres y Fernando antes de unir a `main` (Q4).
- Quedan fuera los cambios en el motor de sonido y la biomasa de GEDI L4B (Q5).
- La revisión del planeta en el navegador va primero; GEDI L3 no frena la decisión de las 11:00 p.m. (Q6).

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
