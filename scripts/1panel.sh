#!/usr/bin/env bash
# Usage: scripts/1panel.sh GET|POST /websites/search ['{"json":true}']
# Signs a request to the 1Panel v1 API. Reads the panel base URL from
# ~/.config/jel/1panel-url (no trailing slash, e.g. http://host:port) and the
# API key from ~/.config/jel/1panel-api-key.
set -euo pipefail
[ -r "$HOME/.config/jel/1panel-url" ] || { echo "missing ~/.config/jel/1panel-url" >&2; exit 2; }
BASE="$(cat "$HOME/.config/jel/1panel-url")/api/v1"
KEY=$(cat "$HOME/.config/jel/1panel-api-key")
TS=$(date +%s)
TOKEN=$(printf '1panel%s%s' "$KEY" "$TS" | md5sum | cut -d' ' -f1)
METHOD=$1; PATH_=$2; BODY=${3:-}
curl -sS -m 20 -X "$METHOD" "$BASE$PATH_" \
  -H "1Panel-Token: $TOKEN" -H "1Panel-Timestamp: $TS" -H "Content-Type: application/json" \
  ${BODY:+--data "$BODY"}
echo
