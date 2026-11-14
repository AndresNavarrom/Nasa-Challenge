# syntax=docker/dockerfile:1
#
# Earth Jukebox final app image: the built interface served by the Rust local
# server. Built from the repository root (see .dockerignore next to this file).
#
#   docker compose build app      needs internet: do it before the demo
#   docker compose up             app on http://127.0.0.1:8080, works offline
#
# Once built, running it downloads nothing: the interface, the prepared NASA
# data and the server binary are all inside the image (FR2, NFR1).

# --- 1. Interface: type-check and build web/ into /app/dist -----------------
FROM node:20-bookworm-slim AS web-build
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build \
    && test -f dist/index.html \
    && test -f dist/data/manifest.json

# --- 2. Server: release build of server/ ------------------------------------
FROM rust:1-slim-bookworm AS server-build
WORKDIR /src
# Compile the dependencies in their own layer with stand-in sources.
COPY server/Cargo.toml server/Cargo.lock ./
RUN mkdir src \
    && echo 'fn main() {}' > src/main.rs \
    && touch src/lib.rs \
    && cargo build --release --locked \
    && rm -rf src
COPY server/src ./src
# Touch the sources so cargo rebuilds the crate over the stand-in build.
RUN touch src/main.rs src/lib.rs \
    && cargo build --release --locked \
    && strip target/release/jukebox-server

# --- 3. Runtime: just the binary and the built interface --------------------
FROM debian:bookworm-slim AS app
RUN useradd --system --no-create-home --shell /usr/sbin/nologin jukebox
WORKDIR /app
COPY --from=server-build /src/target/release/jukebox-server /usr/local/bin/jukebox-server
COPY --from=web-build /app/dist ./dist
USER jukebox
# Inside the container the server listens on every interface so the published
# port reaches it; docker-compose.yml publishes it on 127.0.0.1 only.
ENV JUKEBOX_HOST=0.0.0.0 \
    JUKEBOX_PORT=8080
EXPOSE 8080
CMD ["jukebox-server", "/app/dist"]
