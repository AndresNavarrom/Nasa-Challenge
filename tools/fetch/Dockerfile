# syntax=docker/dockerfile:1
#
# earth-jukebox-fetch: downloads the source data and turns the formats that
# jukebox-prep cannot read (NetCDF, video, 16-bit TIFF) into plain images.
#
# Holds curl, ffmpeg, unzip and Python with netCDF4, numpy and Pillow (fixed
# versions in requirements.txt), plus pytest for the conversion tests.
# docker-compose.yml bind-mounts the repository at /work, so the scripts and
# tests always run from the live source; only a change to this file or to
# requirements.txt needs an image rebuild.

FROM python:3.12.7-slim-bookworm
WORKDIR /work
ENV PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl ffmpeg unzip \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt

CMD ["bash", "tools/fetch-frames.sh"]
