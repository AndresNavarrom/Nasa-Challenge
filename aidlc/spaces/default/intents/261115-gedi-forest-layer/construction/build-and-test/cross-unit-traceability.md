# Cobertura final de requisitos — Bosque con GEDI L3

Este trabajo no se dividió en unidades, así que la cobertura abarca todo lo construido, según `code-summary.md` y `code-generation-plan.md`.

## Veredicto

**Pasa: 14 de 14 requisitos cubiertos**, cada uno con su archivo. No queda ninguno sin cubrir.

| ID | Estado | Archivo |
|---|---|---|
| FR1.1 | Construido | `tools/fetch/fetch-gedi.sh` |
| FR1.2 | Construido | `tools/fetch/fetch-gedi.sh` |
| FR1.3 | Construido | `docker-compose.yml` |
| FR2.1 | Construido | `tools/fetch/gedi_l3_to_png.py` |
| FR2.2 | Construido | `tools/fetch/gedi_l3_to_png.py` |
| FR2.3 | Construido | `tools/fetch/gedi_l3_to_png.py` |
| FR3 | Construido | `tools/prep/src/pipeline.rs` |
| FR4.1 | Construido | `web/public/data/manifest.json` |
| FR4.2 | Construido | `tools/fetch-frames.sh` |
| FR4.3 | Construido | `tools/prep/src/pipeline.rs`; 99,0 % de GEDI en la Amazonía |
| NFR1 | Construido | `docker-compose.yml` |
| NFR2 | Construido | `tools/fetch/gedi_l3_to_png.py`; pico de 1,5 GB |
| NFR3 | Construido | `tools/fetch/tests/test_gedi_l3_to_png.py` |
| NFR4 | Construido | `data/prep-config.json`; los tamaños de los `.bin` no cambiaron |

La alineación visual del bosque con la Amazonía solo se comprueba en un navegador real, con `docs/PLANET-CHECKLIST.md`.
