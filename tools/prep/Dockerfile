# syntax=docker/dockerfile:1
#
# jukebox-prep (Rust): `cargo test` and the data preparation.
#
# The image holds the Rust toolchain, every dependency already downloaded and
# compiled, and a copy of the source. docker-compose.yml bind-mounts the live
# source over that copy and each run compiles it, so a code change needs no
# image rebuild; only a change to Cargo.toml or Cargo.lock does.
#
# Paths mirror the repository (/work = repository root) because jukebox-prep
# is run from the root: it reads data/ and writes web/public/data/.

FROM rust:1-slim-bookworm
WORKDIR /work
# Build output stays inside the image, outside the bind-mounted source, so the
# host never receives Linux binaries and host builds never leak in.
ENV CARGO_TARGET_DIR=/work/target

# Compile the dependencies in their own layer with a stand-in main.rs.
COPY Cargo.toml Cargo.lock tools/prep/
RUN mkdir -p tools/prep/src \
    && echo 'fn main() {}' > tools/prep/src/main.rs \
    && cargo build --locked --manifest-path tools/prep/Cargo.toml \
    && cargo test --locked --no-run --manifest-path tools/prep/Cargo.toml \
    && rm -rf tools/prep/src

COPY src tools/prep/src
# Drop every artifact of the crate itself and keep only its compiled
# dependencies. Cargo decides what is up to date by file time, and bind-mounted
# sources are usually older than the image, so a crate build left in here would
# be reused as "fresh" and the real code would never be compiled or tested.
# Without it, each run compiles the mounted source (a few seconds).
RUN cargo clean --locked -p jukebox-prep --manifest-path tools/prep/Cargo.toml

CMD ["cargo", "test", "--locked", "--manifest-path", "tools/prep/Cargo.toml"]
