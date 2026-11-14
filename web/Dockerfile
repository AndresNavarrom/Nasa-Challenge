# syntax=docker/dockerfile:1
#
# Earth Jukebox web interface (Vite + React + Vitest) on Node 20.
#
# Targets:
#   dev    Vite dev server on 0.0.0.0:5173; also runs the tests and the build
#          (used by the `web` and `web-test` services of docker-compose.yml)
#   test   runs the Vitest suite against the source baked into the image
#   build  type-checks and builds the static site into /app/dist
#          (the final app image of Steps 11 and 15 copies it from here)

FROM node:20-bookworm-slim AS deps
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
# Dependencies are installed from the lock file only, in their own layer, so
# they are rebuilt only when package.json or package-lock.json change.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund \
    && sha256sum package-lock.json | cut -d ' ' -f 1 > node_modules/.package-lock.sha256
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# Strip Windows line endings in case the repository was cloned with CRLF.
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

FROM deps AS dev
COPY . .
EXPOSE 5173
ENTRYPOINT ["docker-entrypoint.sh"]
# vite.config.ts binds to 127.0.0.1 for runs on the host; inside a container
# the server must listen on every interface to be reachable through the
# published port (docker-compose.yml publishes it on 127.0.0.1 only).
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]

FROM dev AS test
CMD ["npm", "test"]

FROM dev AS build
RUN npm run build
