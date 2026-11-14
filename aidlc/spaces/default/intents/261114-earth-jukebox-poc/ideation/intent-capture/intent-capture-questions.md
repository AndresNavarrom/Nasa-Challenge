# Captura de intención — Preguntas

## Sources

- [desc] Initial description: "## Contexto\nSomos el equipo \"Sagitta\" y participamos en el NASA Space Apps Challenge 2026,\nreto \"The Earth Information Jukebox\". Primero haremos un POC para validar la\nidea y luego evolucionaremos a un MVP.\n\nReto (resumen): el Earth Information Center (EIC) de la NASA produce\nvisualizaciones de la Tierra, pero presentar la ciencia solo de forma visual\nlimita su alcance. Hay que crear una \"Jukebox Terrestre\": una interfaz, script\no app que combine imágenes del EIC con sonorización dinámica generada en tiempo\nreal, para que la ciencia de la Tierra sea accesible, atractiva y multisensorial.\n\n## Fuentes (léelas a fondo antes de planear)\n- Equipo: https://www.spaceappschallenge.org/2026/find-a-team/sagitta/\n- Guía de entrega: https://www.spaceappschallenge.org/resources/project-submission-guide/\n- Reto (detalles): https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/?tab=details\n- Reto (recursos): https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/?tab=resources\nExtrae de ahí: criterios de evaluación, entregables obligatorios, datasets y\nherramientas recomendadas. Si una página no se puede leer o falta información,\npregúntanos y te la damos.\n\n## Restricciones (críticas)\n- FECHA LÍMITE: 15 de noviembre de 2026, 11:50 pm (hora Colombia). Hoy es\n  14 de noviembre: quedan unas 33 horas. Planifica en bloques de horas, no de\n  días, y recorta alcance sin dudar.\n- Demo: se mostrará de forma LOCAL, sin depender de internet. Los datos se\n  pueden preprocesar y empaquetar con el proyecto.\n- Equipo (5):\n  - Fernando Gonzalez Rivero: full stack y arquitecto de software.\n  - Andres Navarro Marin: full stack.\n  - Alberto Jaimes Pulido: ingeniero aeronáutico, análisis de datos de la NASA.\n  - Danna Vergara: líder y product owner.\n  - Samuel Betancur Muñoz: full stack y experto en datos.\n- Stack: frontend React + Tailwind + GSAP (o una librería 3D como\n  three.js / react-three-fiber si aporta), backend Axum (Rust), MongoDB.\n  Si algún componente no se justifica para el POC (por ejemplo MongoDB, si\n  bastan archivos preprocesados), dímelo y propón la alternativa más simple.\n\n## Idea\nPlataforma web interactiva con un globo/mapa de la Tierra (SVG) sobre el que se\nsuperponen capas de datos del EIC (imágenes .exr) que se pueden activar,\ncombinar y animar en el tiempo.\n1. Procesamiento de datos: convertir los .exr a valores numéricos por\n   píxel/región (en Rust, p. ej. con el crate `exr`, o con un script previo en\n   Python), con interpolación o extrapolación para mejorar la resolución\n   espacial y temporal.\n2. Sonificación: cada variable se mapea a parámetros sonoros (tono, ritmo,\n   timbre, volumen, paneo). Combina síntesis en tiempo real (Web Audio API) con\n   samples precargados para mejorar la interactividad y reducir la latencia.\n3. Interacción: al pasar o hacer clic sobre una región o capa se escucha su\n   \"música\"; el tiempo se puede reproducir como una canción.\n4. Visión artificial (opcional): evalúa si un modelo de visión aporta algo para\n   extraer datos de las imágenes. Si un procesamiento clásico basta, dilo y\n   justifícalo. No lo incluyas en el POC si pone en riesgo la fecha.\n\n## Lo que necesito de ti\n1. Antes de planear, hazme solo las preguntas indispensables (máximo 8,\n   agrupadas). Mi equipo las responde rápido.\n2. Define un POC realista para 33 horas: pocas capas (2-3), un pipeline\n   completo dato → interpolación → sonido, y una demo sólida. Lista aparte lo\n   que queda para el MVP.\n3. Reparte el trabajo por rol (frontend/3D, backend Rust, datos, sonido,\n   producto/entregables) para que se pueda trabajar en paralelo.\n4. Incluye en el plan los entregables de la guía de entrega (video, resumen,\n   etc.) y reserva tiempo para ellos al final.\n5. Señala riesgos técnicos (lectura de .exr, rendimiento del globo, latencia\n   de audio) y un plan B para cada uno.\n6. Sigue el flujo de AIDLC por etapas, con aprobaciones breves, porque el\n   tiempo es limitado."
- [scope] Workflow-selected scope: `poc`.

## Q1. [Líder de equipo] Lo que extraje de las cuatro fuentes del reto

Leí las cuatro páginas que nos pasaron (equipo, guía de entrega, detalles y recursos del reto) y además la guía de evaluación enlazada desde la guía de entrega. Como todo el plan se apoya en estas reglas, necesito que confirmen que las entendí bien:

- **Fecha límite oficial**: hay que pulsar "Submit for Judging" antes del domingo 15 de noviembre a las 11:59 p.m., hora local del evento (Medellín). Lo guardado o enviado después no se evalúa. Ustedes fijaron 11:50 p.m. como límite; lo tomo como límite interno.
- **Demo obligatorio**: un video de 30 segundos o menos, o una presentación de máximo 7 diapositivas (contando título e introducción). Pasarse de esos límites deja al proyecto fuera de la evaluación global. Debe estar en un enlace público, sin login ni permisos.
- **Idioma**: el formulario del proyecto y todo material enlazado deben estar en inglés. Única excepción: el video puede hablarse en otro idioma si lleva subtítulos en inglés.
- **Formulario del proyecto**: todos los campos obligatorios deben estar completos. Cubren: resumen, enlace del demo, enlace del proyecto, detalles del proyecto (qué hace, cómo funciona, qué beneficios tiene, qué esperan lograr, qué herramientas y lenguajes usaron), uso de inteligencia artificial, datos y recursos de la NASA usados, y referencias (todo código, texto e imagen externo, aunque sea libre).
- **Uso de inteligencia artificial**: está permitido como herramienta, pero no para idear la solución, y hay que declararlo: imágenes y videos generados con IA llevan marca de agua visible; audio, código y datos generados con IA se reconocen en el texto descriptivo y en los metadatos. No se puede usar ni modificar la marca NASA.
- **Criterios de evaluación (5)**: Impact, Creativity, Validity, Relevance (incluye qué tan integrados están los datos de la NASA) y Presentation. El demo pesa sobre todo en Presentation; la mayor parte de la nota sale del formulario del proyecto.
- **Elegibilidad**: todos los integrantes registrados en el mismo evento local (Medellín), máximo 6 por equipo, y ningún material puede mostrar a menores de 18 años.
- **Lo que pide el reto**: una experiencia en la que alguien elige o vive una visualización del EIC junto con su paisaje sonoro. La accesibilidad para personas ciegas o con baja visión es un tema central. Pide equilibrar la traducción fiel del dato con que suene musical y agradable, y recomienda documentar el porqué de las decisiones artísticas.
- **Datos recomendados**: la galería del EIC en el Scientific Visualization Studio (SVS) de la NASA y diez visualizaciones concretas: luces nocturnas 2012–2023, corrientes y temperatura superficial del mar, aerosoles GEOS, modelos de calidad del aire, Perpetual Ocean 2, CO2 global DYAMOND, rayos detectados desde la Estación Espacial 2017–2023, río atmosférico en 3D, altura de bosques GEDI, y la sonificación de Caldwell 73 como referencia conceptual.

A. All correct
B. Some need changing (say which and how)
C. Not yet defined (el equipo aún no ha verificado estas reglas)
X. Other (please specify)

[Answer]: A

## Q2. [Producto] ¿Para quién debe funcionar mejor esta primera versión?

El reto pone la accesibilidad en el centro, pero en 33 horas no se puede servir igual de bien a todos. De esta respuesta depende cuánto esfuerzo va a la experiencia sin vista frente a la experiencia visual.

A. Público general y jurado: una experiencia vistosa que combine imagen y sonido
B. Personas ciegas o con baja visión: debe poder usarse y entenderse sin ver la pantalla
C. Ambos: experiencia visual completa más un mínimo de accesibilidad (uso con teclado y descripciones en texto)
D. Not yet defined
X. Other (please specify)

[Answer]: A

## Q3. [Producto] ¿Qué significa "salió bien" el 15 de noviembre?

Con el tiempo que hay conviene apuntar a uno o dos de los cinco criterios de evaluación. Esto decide qué se pule y qué se deja básico.

A. Creatividad y presentación: que la experiencia sorprenda y suene bien, aunque la traducción del dato sea sencilla
B. Validez y relevancia: que el sonido refleje fielmente datos reales de la NASA, aunque la interfaz sea sobria
C. Impacto: que se note que acerca la ciencia de la Tierra a personas que hoy no pueden acceder a ella
D. Not yet defined
X. Other (please specify)

[Answer]: X. Nuestros criterios es impacto local. impacto global conecte mejor con una problematica social como es la contaminacion enfocado a regiones que se deben cuidar, lo mas inspirador, mejor uso de narracion de historias, mejor uso de los datos

## Q4. [Producto] ¿Qué formato tendrá el demo oficial?

La guía solo acepta una de dos formas y descalifica si se excede el límite. Hay que decidirlo ya para reservar el tiempo correcto al final. La demostración local en vivo es aparte y no cambia con esta respuesta.

A. Video de 30 segundos o menos, narrado en inglés
B. Video de 30 segundos o menos, narrado en español con subtítulos en inglés
C. Presentación de máximo 7 diapositivas en inglés
D. Not yet defined
X. Other (please specify)

[Answer]: A

## Q5. [Líder de equipo] ¿Cuántas personas trabajan en el proyecto?

La página del equipo muestra seis integrantes (incluye a Andres David Osorno Vasquez), pero la descripción reparte el trabajo entre cinco. Necesito saber con cuántas manos cuenta el plan.

A. Cinco: Andres David Osorno Vasquez no participa en el desarrollo
B. Seis: Andres David Osorno Vasquez también participa (indiquen su perfil en la respuesta)
C. Not yet defined
X. Other (please specify)

[Answer]: B

## Q6. [Producto] ¿Qué NO debe hacer esta primera versión? (select all that apply)

El plan elegido es una prueba de concepto (`poc`). Para recortar sin dudar, necesito saber qué queda expresamente fuera de esta primera versión y pasa a la lista de la versión siguiente.

A. Reconocer contenido de las imágenes con modelos de visión artificial o aprendizaje automático
B. Cuentas de usuario o guardar información de quien la usa
C. Estar publicada en internet para uso público (solo se muestra de forma local)
D. None
X. Other (please specify)

[Answer]: B, C

## Q7. [Producto] ¿Qué historia de contaminación cuenta la jukebox, y sobre qué región?

En la pregunta sobre qué significa "salió bien" (Q3) dijeron que quieren conectar con una problemática social como la contaminación, enfocada en regiones que se deben cuidar, con impacto local y global. Para elegir las dos o tres capas de datos y armar la narración necesito saber cuál es esa historia.

A. Calidad del aire, de lo local a lo global: empieza en Medellín y el Valle de Aburrá y se abre al planeta
B. Contaminación del aire en el mundo: las regiones más afectadas del planeta, sin foco en una ciudad
C. Humo e incendios sobre bosques que hay que cuidar, como la Amazonía
D. Not yet defined
X. Other (please specify)

[Answer]: X. Como tal no es algo de contaminacion si no una concientizacion del amazonas que es calificado como el pulmon del mundo y por ende se centra en el mismo y de acuerdo al impacto que se ve en algunas de las simulaciones que tanto afectan este pulmon y al mismo tiempo como este pulmon funciona. algo relacionado entre el impacto, importancia, y comportamiento  del pulmon del mundo que es el amazonas

## Q8. [Líder de equipo] ¿Cuál es el perfil de Andres David Osorno Vasquez?

En la pregunta sobre cuántas personas trabajan en el proyecto (Q5) respondieron que son seis, pero faltó su perfil. La página del equipo dice que son tres estudiantes de Ingeniería Aeronáutica y tres de Ingeniería de Sistemas; lo necesito para repartir el trabajo.

A. Ingeniería de Sistemas: puede tomar tareas de desarrollo
B. Ingeniería Aeronáutica: puede apoyar el análisis de datos de la NASA
C. Apoya producto y entregables (resumen, video, formulario), no desarrollo
D. Not yet defined
X. Other (please specify)

[Answer]: B

## Consolidated Summary Confirmation

- Las reglas extraídas de las fuentes del reto son correctas (Q1): cierre oficial el 15 de noviembre a las 11:59 p.m. hora de Medellín, demo de 30 segundos o 7 diapositivas, todo en inglés, uso de IA declarado y cinco criterios de evaluación.
- Esta primera versión se piensa primero para el público general y el jurado: una experiencia vistosa que combine imagen y sonido (Q2).
- "Salió bien" significa apuntar a impacto local, impacto global conectado con una problemática social, lo más inspirador, la mejor narración de historias y el mejor uso de los datos (Q3).
- El demo oficial será un video de 30 segundos o menos, narrado en inglés (Q4).
- Trabajan seis personas: Andres David Osorno Vasquez también participa (Q5) y su perfil es Ingeniería Aeronáutica, con apoyo al análisis de datos de la NASA (Q8).
- Quedan fuera de esta primera versión: cuentas de usuario o guardar información de quien la usa, y publicarla en internet para uso público (Q6).
- La historia no es la contaminación en sí, sino la concientización sobre la Amazonía como pulmón del mundo: su importancia, cómo funciona y el impacto que muestran las simulaciones sobre ella (Q7).

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
