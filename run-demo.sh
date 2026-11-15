#!/usr/bin/env bash
#
# Earth Jukebox demo launcher (macOS, Linux, Git Bash on Windows).
#
#   ./run-demo.sh            start the app and open http://127.0.0.1:8080
#   ./run-demo.sh --build    rebuild the app image first (NEEDS INTERNET)
#   ./run-demo.sh --stop     stop the app
#   ./run-demo.sh --no-open  start it without opening the browser
#
# Without --build it never touches the network: it runs the app image already
# built on this machine (`docker compose build app`), so it works with the
# network cable unplugged (FR2, NFR1). Windows PowerShell: run-demo.ps1.

set -euo pipefail

URL="http://127.0.0.1:8080"
IMAGE="earth-jukebox-app:latest"
TIMEOUT_S=30

cd "$(dirname "$0")"

build=0
open_browser=1
for arg in "$@"; do
  case "$arg" in
    --build) build=1 ;;
    --no-open) open_browser=0 ;;
    --stop)
      docker compose down >/dev/null 2>&1 || true
      echo "Earth Jukebox stopped."
      exit 0
      ;;
    -h|--help)
      sed -n '3,13p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "run-demo: unknown option $arg (see ./run-demo.sh --help)" >&2
      exit 2
      ;;
  esac
done

fail() {
  echo "run-demo: $*" >&2
  exit 1
}

# Milliseconds since the epoch; falls back to whole seconds where `date` lacks %N (macOS).
now_ms() {
  local ns
  ns=$(date +%s%N 2>/dev/null)
  if [[ "$ns" =~ ^[0-9]+$ ]]; then echo $((ns / 1000000)); else echo $(( $(date +%s) * 1000 )); fi
}

# True when the server answers the page.
answering() {
  if command -v curl >/dev/null 2>&1; then
    curl -fs -o /dev/null --max-time 1 "$URL/" 2>/dev/null
  else
    (exec 3<>/dev/tcp/127.0.0.1/8080) 2>/dev/null
  fi
}

command -v docker >/dev/null 2>&1 \
  || fail "Docker is not installed. Install Docker Desktop, then run this again."
docker info >/dev/null 2>&1 \
  || fail "Docker is not running. Start Docker Desktop, wait until it says it is running, then run this again."

if [[ $build -eq 1 ]]; then
  echo "Building the app image (needs internet)..."
  docker compose build app
elif ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  fail "the app image is not built on this machine. While you still have internet, run: ./run-demo.sh --build"
fi

if answering; then
  if docker compose ps --status running --services 2>/dev/null | grep -qx app; then
    echo "Earth Jukebox is already running on $URL"
  else
    fail "something else is already using port 8080. Close it (or run ./run-demo.sh --stop) and try again."
  fi
else
  start=$(now_ms)
  # --no-build and --pull never: start only what is on this machine, never the network.
  if ! up_log=$(docker compose up -d --no-build --pull never app 2>&1); then
    echo "$up_log" >&2
    fail "the app container did not start (output above)."
  fi
  deadline=$((start + TIMEOUT_S * 1000))
  until answering; do
    if (( $(now_ms) > deadline )); then
      docker compose logs --tail 20 app >&2 || true
      fail "the app did not answer within ${TIMEOUT_S} s (log above)."
    fi
    sleep 0.1
  done
  elapsed=$(( $(now_ms) - start ))
  echo "Earth Jukebox is ready on $URL (started in $((elapsed / 1000)).$(( (elapsed % 1000) / 100 )) s)"
fi

if [[ $open_browser -eq 1 ]]; then
  if command -v open >/dev/null 2>&1; then
    open "$URL"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 &
  elif command -v cmd.exe >/dev/null 2>&1; then
    cmd.exe /c start "" "$URL"
  else
    echo "Open $URL in the browser."
  fi
fi

echo "Stop it with: ./run-demo.sh --stop"
