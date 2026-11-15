# Visión de negocio — Earth Jukebox

## Propósito

Earth Jukebox (equipo Sagitta, NASA Space Apps Challenge 2026, reto "The Earth Information Jukebox") es una prueba de concepto local que hace que los datos de la Tierra se puedan ver y escuchar. Abre un planeta 3D con capas de datos de la NASA; cada capa tiene su propia voz sonora y, al enfocar la Amazonía, el planeta se aplana en un mapa regional detallado. La historia: la Amazonía como pulmón del mundo (`README.md`, `VISION-MISION.md`).

## Funcionalidad clave

- **Capas de datos** (definidas en `data/prep-config.json`, publicadas en `web/public/data/manifest.json`):
  - `forest` — altura del bosque, hoy leída del color de 14 vistas 4K del globo de GEDI (NASA SVS 4950); capa base fija.
  - `smoke` — PM2.5 de superficie del modelo GEOS-CF v2, 24 horas del 1 de septiembre de 2026, escala fija 0–150 µg/m³.
  - `lightning` — frecuencia relativa de rayos vistos por LIS en la ISS, 2017–2023 (SVS 5011).
  - `co2` — aceptado por el formato pero ya no listado en los datos.
- **Planeta y mapa**: globo que gira, se arrastra y, con un clic en la Amazonía o el botón "Amazon", se aplana en el mapa del rectángulo 80 W–44 W, 20 S–8 N (1.6 s ida, 1.4 s vuelta).
- **Punto de escucha**: longitud, latitud y valor de la capa activa bajo el cursor, para el motor de sonido.
- **Sonorización**: funciones puras valor→sonido (nota pentatónica del bosque, aspereza del humo, respiración del CO2, paneo y volumen); el motor Web Audio aún no existe.
- **Funciona sin internet**: todos los datos y fuentes son locales.

## Dominio y reglas

- Los valores son intensidades relativas 0..1 (1 byte por celda), no mediciones físicas, salvo el humo que usa una escala física fija.
- Cuadrícula global 1440×720 (0.25°) y regional de la Amazonía por capa (bosque y rayos 360×280, humo 144×112).
- Fuentes públicas de la NASA sin login hoy; `data/SOURCES.md` registra cada archivo y enlace.

## Contexto del intent activo

El intent `gedi-forest-layer` reemplaza la fuente del bosque por GEDI L3 V3 (altura media del dosel, 1 km, ORNL DAAC), descargada con Earthdata Login, y rellena fuera de ±52° con SVS 4950. Los detalles técnicos de entrada están en `architecture.md` y `code-quality-assessment.md`.
