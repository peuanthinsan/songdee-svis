#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "${script_dir}/.." && pwd)"
source_file="${repo_dir}/store-assets/screenshots/source/login-master.html"

if [[ -n "${CHROME_BIN:-}" ]]; then
  chrome_bin="${CHROME_BIN}"
elif [[ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]]; then
  chrome_bin="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
elif [[ -x "/opt/pw-browsers/chromium" ]]; then
  chrome_bin="/opt/pw-browsers/chromium"
else
  echo "Chrome/Chromium not found. Set CHROME_BIN to a headless Chromium executable." >&2
  exit 1
fi

render() {
  local width="$1"
  local height="$2"
  local output="$3"
  local render_dir
  local render_output
  local chrome_pid

  render_dir="$(mktemp -d /private/tmp/svis-store-render.XXXXXX)"
  render_output="${render_dir}/screenshot.png"

  "${chrome_bin}" \
    --headless=new \
    --no-sandbox \
    --disable-gpu \
    --disable-dev-shm-usage \
    --disable-crash-reporter \
    --hide-scrollbars \
    --allow-file-access-from-files \
    --run-all-compositor-stages-before-draw \
    --virtual-time-budget=1500 \
    --user-data-dir="${render_dir}/profile" \
    --window-size="${width},${height}" \
    --screenshot="${render_output}" \
    "file://${source_file}" >/dev/null 2>&1 &
  chrome_pid=$!

  for _ in $(seq 1 100); do
    [[ -s "${render_output}" ]] && break
    if ! kill -0 "${chrome_pid}" 2>/dev/null; then
      break
    fi
    sleep 0.1
  done

  if kill -0 "${chrome_pid}" 2>/dev/null; then
    kill "${chrome_pid}" 2>/dev/null || true
  fi
  wait "${chrome_pid}" 2>/dev/null || true

  if [[ ! -s "${render_output}" ]]; then
    echo "Failed to render ${width}x${height} screenshot." >&2
    rm -rf "${render_dir}"
    exit 1
  fi

  mv "${render_output}" "${output}"
  rm -rf "${render_dir}"
}

render 1080 1920 "${repo_dir}/store-assets/screenshots/phone/01-login.png"
render 1200 1920 "${repo_dir}/store-assets/screenshots/tablet7/01-login.png"
render 1600 2560 "${repo_dir}/store-assets/screenshots/tablet10/01-login.png"

echo "Rendered SVIS login screenshots for phone, 7-inch tablet, and 10-inch tablet."
