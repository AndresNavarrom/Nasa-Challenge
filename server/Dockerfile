# syntax=docker/dockerfile:1
#
# jukebox-server (Rust, Axum): `cargo test` and the local server for development.
#
# Same layout as tools/prep/Dockerfile: the image holds the toolchain and the
# compiled dependencies; docker-compose.yml bind-mounts the live source, so a
# code change needs no rebuild, only a change to Cargo.toml or Cargo.lock does.
# Paths mirror the repository (/work = repository root) so the server finds
# web/dist at its default path.
#
# The final app image (built interface + release binary) is added in plan
# Step 15 / block B2.

# Same exact Rust version as the app image in the root Dockerfile.
FROM rust:1.100.0-slim-bookworm AS dev
WORKDIR /work
# Build output stays inside the image, outside the bind-mounted source.
ENV CARGO_TARGET_DIR=/work/target

# Compile the dependencies in their own layer with stand-in sources.
COPY Cargo.toml Cargo.lock server/
RUN mkdir -p server/src \
    && echo 'fn main() {}' > server/src/main.rs \
    && touch server/src/lib.rs \
    && cargo build --locked --manifest-path server/Cargo.toml \
    && cargo test --locked --no-run --manifest-path server/Cargo.toml \
    && rm -rf server/src

COPY src server/src
# Drop the crate's own artifacts so each run compiles the mounted source
# (see tools/prep/Dockerfile for why a stale build would be reused).
RUN cargo clean --locked -p jukebox-server --manifest-path server/Cargo.toml

CMD ["cargo", "test", "--locked", "--manifest-path", "server/Cargo.toml"]
