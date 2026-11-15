# Declaración de intención — Bosque con datos reales de GEDI L3

## Problem Statement

- La capa de bosque de la Jukebox Terrestre debe mostrar datos reales de GEDI L3 (altura media del dosel en cuadrícula de 1 km, de ORNL DAAC), en lugar de los cuadros en 4K del video de SVS 4950. [desc]
- Se usa GEDI L3 Gridded Land Surface Metrics, Versión 3, con datos de abril de 2019 a julio de 2025. [Q1]
- No hay respaldo: la capa de bosque tiene que salir de GEDI L3. [Q2]
- Fuera de la franja que mide GEDI, a unos 52 grados de latitud norte y sur, el bosque se completa con los valores actuales de SVS 4950. [Q3]

## Target Customer

- Samuel hace el cambio en la rama `interfaz`. [Q4]

## Success Metrics

- La capa de bosque queda en una cuadrícula global de 1440 × 720 y en una regional de la Amazonía de 360 × 280. [desc]
- `data/SOURCES.md` y la descripción de la capa nombran GEDI L3 como fuente. [desc]
- La descarga corre en el contenedor de Docker `fetch` y usa la cuenta de NASA Earthdata del equipo desde `~/.netrc`, montado en solo lectura. La contraseña no entra al repositorio ni a las imágenes. [desc]

## Initiative Trigger

- La capa de bosque actual sale del color de un video de globo, no de mediciones. [desc]

## Initial Scope Signal

- Alcance del flujo de trabajo (workflow-selected): `poc`. [scope]
- Quedan fuera de este trabajo los cambios en el motor de sonido para la capa de bosque y la biomasa de GEDI L4B. [Q5]
- La revisión del planeta en el navegador va primero; GEDI L3 no frena la decisión de las 11:00 p.m. [Q6]
- Andres y Fernando reciben aviso antes de unir a `main`. [Q4]

## Assumptions & Open Questions

None.
