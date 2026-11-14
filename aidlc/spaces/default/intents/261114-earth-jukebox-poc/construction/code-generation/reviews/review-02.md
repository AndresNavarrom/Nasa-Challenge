## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-14T21:46:42Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | aidlc/spaces/default/intents/261114-earth-jukebox-poc/construction/code-generation/unit-test-instructions.md > comando de pruebas de la interfaz | El comando `npm --prefix web exec -- vitest run ... src/ui/a11y.test.ts` nombra un archivo que no existe (es del Step 14), así que quien lo copie literal verá un fallo aunque la base esté bien. El resumen lo admite, pero las instrucciones no lo advierten. | Añadir en las instrucciones una nota de que `a11y.test.ts` aparece con el Step 14, o quitarlo del comando hasta entonces. | Resolved (reviewer) |
| R-02 | Minor | web/package.json > dependencies / devDependencies | Nadie ha corrido `npm install` ni hay `package-lock.json`; las versiones exactas solo se resolvieron con Deno. Además `web/node_modules` y `web/deno.lock` los creó Deno. Los tres compañeros que ramifiquen pueden tropezar en la primera instalación o generar lockfiles distintos. | Que el primero que tenga Node corra `npm install`, haga commit de `package-lock.json` y borre `web/node_modules` antes de que el resto ramifique. | Resolved (reviewer) |
| R-03 | Minor | web/src/lib/timeline.ts > framePosition / web/public/data/manifest.json > smoke.dates | Los cuadros de humo son tiempos del clip con saltos desiguales (0:04 a 0:53 a 0:57), pero la línea de tiempo los reparte a intervalos iguales. La etiqueta mostrada es honesta, pero el avance de humo no es proporcional al tiempo del clip. | Dejarlo anotado como límite conocido de la demo, o documentarlo en `data/SOURCES.md`. | Unresolved |
| R-04 | Minor | web/src/lib/interpolate.ts > sampleLayerAt | Al cruzar el borde del rectángulo de la Amazonía se pasa de la cuadrícula regional (0,375 grados por celda) a la global (2,5 grados por celda) sin mezcla, así que el sonido del bosque puede dar un salto audible en el borde. Las pruebas no cubren ese cruce. | Quien construya el motor de sonido (Step 10) debe saberlo; opcionalmente añadir una prueba o un suavizado de volumen en el cruce. | Unresolved |
| R-05 | Minor | web/public/data/manifest.json > co2.title | El título "Global CO2" describe una capa que solo cubre la Amazonía y se mostrará así en la interfaz. El resumen lo declara. | Cambiar el título en `data/prep-config.json` y regenerar, antes de que el Step 12 lo use. | Unresolved |
| R-06 | Minor | docker-compose.yml > services `web` y `web-test` (volumen `web_node_modules`) | Ambos servicios comparten el volumen de dependencias y el entrypoint puede ejecutar `npm ci` cuando cambia `package-lock.json`. Si un compañero deja `web` levantado y otro lanza `web-test` justo después de un cambio del lockfile, los dos reinstalan sobre el mismo volumen a la vez. | Anotar en el README que tras un cambio de `package-lock.json` se baje `web` (`docker compose down`) antes de correr `web-test`, o dejar que el primer arranque haga la reinstalación. | New |
| R-07 | Minor | web/Dockerfile > etapa `deps` (línea `sed -i`) y repositorio sin `.gitattributes` | El entrypoint se protege de finales de línea CRLF dentro de la imagen, pero el repositorio no fija `eol=lf` para `*.sh`; en Windows un clon con CRLF afecta a los scripts de host y a futuros `.sh`. Dentro de Docker queda cubierto. | Opcional: añadir `.gitattributes` con `*.sh text eol=lf`. | New |

> R-01 Reviewer note: `unit-test-instructions.md` línea 27 ya avisa de que `a11y.test.ts` aparece con el Step 14 y que hay que quitarlo del comando hasta entonces.

> R-02 Reviewer note: `web/package-lock.json` existe y está versionado; `web/deno.lock` ya no está y queda ignorado. Dentro de Docker `npm ci` instala desde ese lockfile y las pruebas corren.

> R-03 Reviewer note: Sin cambios: `data/SOURCES.md` no anota que los cuadros de humo avanzan a intervalos iguales aunque sus tiempos de clip son desiguales. Límite conocido de la demo.

> R-04 Reviewer note: Sin cambios: `interpolate.ts` no mezcla en el borde del rectángulo de la Amazonía. Hay que tenerlo presente al construir el motor de sonido (Step 10).

> R-05 Reviewer note: `manifest.json` sigue titulando la capa de CO2 como "Global CO2" aunque solo cubre la Amazonía. Corregir en `data/prep-config.json` antes del Step 12.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `docker compose config --quiet` | PASS, sin salida | El archivo compose es válido. |
| `docker compose run --rm web-test` | PASS: 4 archivos, 13 pruebas (Vitest 3.2.7) | La lógica pura del Step 9 pasa dentro del contenedor, con el lockfile versionado. |
| `docker compose run --rm prep-test` | PASS: 5 de 5 pruebas de `cargo test --locked` | El contenedor compila el código montado en cada corrida, no una compilación de relleno; coincide con lo que dice el resumen. |

### Summary

La base (Steps 1 a 9 más el Step 17) es segura para que tres personas ramifiquen: el compose es válido, las 13 pruebas web y las 5 de Rust pasan en Docker, el lockfile ya está versionado y el resumen describe fielmente lo construido y lo diferido. Quedan solo observaciones menores: tres de la revisión anterior y dos nuevas sobre el volumen compartido y los finales de línea.
