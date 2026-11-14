# Análisis de requisitos — Preguntas

Contexto: la descripción inicial y la declaración de intención (`intent-statement.md`) ya responden casi todo. Estas tres preguntas son las únicas que bloquean la definición de la prueba de concepto. Las decisiones de arquitectura (por ejemplo, si hace falta base de datos) no se preguntan: van como recomendación en los requisitos para que las aprueben o corrijan.

## Q1. [Datos] ¿Qué archivos de las visualizaciones del EIC tienen ya en mano?

La idea parte de imágenes .exr. Revisé seis de las visualizaciones recomendadas (CO2 global, aerosoles, altura de bosques, calidad del aire, rayos, corrientes del mar) y lo que publican para descargar son videos mp4 y cuadros png, jpg y tif; no encontré archivos .exr listados. Además, varias son animaciones con la cámara en movimiento, no mapas planos. De esto depende todo el paso de procesamiento de datos.

A. Ya tenemos archivos .exr descargados (indiquen de qué visualizaciones)
B. Todavía no tenemos nada descargado: usar lo que publican las páginas (videos mp4 y cuadros png, jpg, tif)
C. Not yet defined
X. Other (please specify)

[Answer]: X. Ya sabes cuales son, pero todavia no los hemos descargado

## Q2. [Producto] ¿Qué capas cuentan la historia de la Amazonía como pulmón del mundo?

La revisión de la etapa anterior pidió tratar esto como la primera decisión. Propongo tres capas que cubren los tres ángulos que mencionaron: cómo funciona (el bosque), el impacto (el humo) y la importancia para el planeta (el CO2).

A. Altura de bosques (GEDI) + calidad del aire y humo de incendios (GEOS-CF, julio–agosto 2024) + CO2 global (DYAMOND) (Recommended)
B. Solo dos capas, para reducir riesgo: altura de bosques (GEDI) + calidad del aire y humo de incendios
C. Altura de bosques (GEDI) + aerosoles (GEOS) + rayos detectados desde la Estación Espacial
D. Not yet defined
X. Other (please specify)

[Answer]: A

## Q3. [Producto] ¿La prueba de concepto incluye un mínimo de accesibilidad?

El reto pone en el centro a las personas ciegas o con baja visión, y ustedes priorizaron al público general. La revisión de la etapa anterior pidió decidir si entra un mínimo; afecta el criterio Relevance y cuesta pocas horas si se decide desde el inicio.

A. Sí, un mínimo: se puede usar con teclado y cada capa y región tiene una descripción en texto que un lector de pantalla puede leer (Recommended)
B. No: la accesibilidad queda fuera de la prueba de concepto y pasa a la lista del MVP
C. Not yet defined
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Datos (Q1): todavía no hay nada descargado. Se parte de lo que publican las páginas de las visualizaciones elegidas (videos mp4 y cuadros png, jpg, tif); los .exr solo se usan si aparecen al descargar.
- Capas (Q2): altura de bosques (GEDI), calidad del aire y humo de incendios (GEOS-CF, julio–agosto 2024) y CO2 global (DYAMOND).
- Accesibilidad (Q3): entra un mínimo: uso con teclado y una descripción en texto de cada capa y región que un lector de pantalla pueda leer.
- Decisiones que propongo sin preguntar, para que las corrijan si no están de acuerdo: sin MongoDB (bastan archivos preprocesados empaquetados con el proyecto); un mapa plano de la Amazonía y su entorno en lugar de un globo 3D; Rust para el preprocesamiento y para servir la app de forma local; sin visión artificial en la prueba de concepto.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
