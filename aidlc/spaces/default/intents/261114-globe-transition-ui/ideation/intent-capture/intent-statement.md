# Declaración de intención — Paso 12: planeta, transición y mapa de la Amazonía

## Problem Statement

- La Jukebox Terrestre necesita su vista principal: un planeta 3D que gira con la textura de la capa activa, una transición a la Amazonía con giro y aplanado, y un mapa regional de la Amazonía. [desc]
- El punto bajo el cursor se convierte en longitud y latitud para alimentar el sonido. [desc]
- Fernando entregó más datos e información que pueden mejorar el planeta 3D y sus capas, y hay que tenerlos en cuenta. [Q1]
- Esos datos llegan en la PR #1 de la rama `datos-rust`, validada: trae scripts para descargar datos de GEOS-FP, no los datos ya preparados. [Q2]
- Este paso incorpora ya una capa global de aerosoles de GEOS-FP. [Q3]

## Target Customer

- El trabajo es de Samuel, en la rama `interfaz`. [desc]
- El planeta es para el público general y el jurado, y cuenta la historia de la Amazonía como pulmón del mundo. [Q4]

## Success Metrics

- Antes de las 11:00 p.m. de hoy funciona con la capa del bosque. [desc]
- La transición a la Amazonía, de ida y de vuelta, tarda 2 segundos o menos. [desc]
- El cursor entrega longitud y latitud del punto que señala. [desc]
- El planeta muestra una capa global de aerosoles hecha con datos de GEOS-FP. [Q3]
- Si no se llega a 30 cuadros por segundo, se aplica el plan B: primero texturas más pequeñas; si no basta, planeta fijo sin giro libre y cambio directo al mapa, sin aplanado animado. [Q5]

## Initiative Trigger

- A las 11:00 p.m. de hoy se decide si se mantiene el planeta o se pasa al plan B. [desc]
- La PR #1 de Fernando aporta una fuente de datos con cobertura global. [Q2]

## Initial Scope Signal

- Alcance del flujo de trabajo (workflow-selected): `poc`. [scope]
- Este paso suma una capa global de aerosoles de GEOS-FP al planeta, además del bosque. [Q3]
- Los datos de GEOS-FP se convierten en un contenedor de Docker. [Q7]
- Quedan fuera de este paso: el panel lateral y la línea de tiempo; el modo historia y la pantalla de inicio; la accesibilidad con teclado y lector de pantalla; y el motor de sonido, del que este paso solo entrega longitud y latitud. [Q6]

## Assumptions & Open Questions

None.
