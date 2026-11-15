# Declaración de intención — Mejora de resolución del planeta y las capas

## Problem Statement

- El planeta y las capas de la Jukebox Terrestre se ven con poca resolución; hay que mejorarlos con datos reales. [desc]
- La capa de humo deja los cuadros del video de SVS 5533 y pasa a PM2.5 global de GEOS-CF v2 (`aqc_tavg_1hr_glo_L1440x721_slv`, 0,25 grados, 1 de septiembre de 2026). [desc]
- Ese humo de GEOS-CF reemplaza la capa de carbono negro de GEOS-FP que se le había pedido a Andres, y ese encargo se cancela. [Q2]
- La capa de CO2 se reemplaza por una capa de rayos hecha con el video para esfera de SVS 5011 (`iss_lightning_sos_yearly_07312023_2048p60.mp4`, 4096 × 2048 equirectangular). [desc]
- El bosque se mejora con los cuadros en 4K del video de SVS 4950, en lugar de GEDI L3. [Q6]

## Target Customer

- Samuel hace la conversión de datos y el cambio del formato en la rama `interfaz`. [Q3]

## Success Metrics

- La imagen base del planeta es Natural Earth 10m a color con relieve, a 8192 × 4096 en el globo y con un recorte de alta resolución para el mapa de la Amazonía. [desc] [Q1]
- Las cuadrículas globales suben a 1440 × 720. [desc]
- Los rayos se muestran como un solo mapa con todo el periodo acumulado, de 2017 a 2023. [Q4]
- La conversión corre en Docker. [desc]

## Initiative Trigger

- El planeta y las capas no se ven adecuadamente con la resolución actual. [desc]

## Initial Scope Signal

- Alcance del flujo de trabajo (workflow-selected): `poc`. [scope]
- Queda fuera de este trabajo ajustar el motor de sonido para la capa de rayos. [Q5]
- Andres y Fernando reciben aviso antes de unir el cambio a `main`. [Q3]

## Assumptions & Open Questions

None.
