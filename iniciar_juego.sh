#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "No se encontró Python 3. Instálalo desde https://www.python.org/downloads/ y vuelve a intentarlo."
  exit 1
fi

if [ ! -x ".venv/bin/python" ]; then
  python3 -m venv .venv
fi

.venv/bin/python -m pip install -r backend/requirements.txt
exec .venv/bin/python -m backend.app
