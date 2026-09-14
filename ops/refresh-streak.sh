#!/bin/sh
# Refreshes the live commit streak the site fetches at /live/streak.json.
#
# The figure baked into a build is only as fresh as that build, and Jordan does not push to this
# repo every day, so without this the shift board in the bay would sit on an old number. This runs
# on the host on a timer, writes into the directory compose mounts read only into the container,
# and leaves the last good file alone on any failure.
#
#   install: copy to /home/administrator/jel.dev/refresh-streak.sh, chmod +x, then
#            */30 * * * * /home/administrator/jel.dev/refresh-streak.sh >/dev/null 2>&1
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
OUT="$HERE/live"
TMP="$OUT/.streak.json.tmp"
mkdir -p "$OUT"
# The scraper that ships inside the running image, so this can never drift from the deployed site.
docker cp jel-dev:/srv/streak.mjs "$HERE/streak.mjs" >/dev/null 2>&1 || true
[ -f "$HERE/streak.mjs" ] || exit 0
rm -f "$TMP"
/usr/bin/node "$HERE/streak.mjs" 9je "$TMP"
# streak.mjs writes nothing when github is slow or has changed shape, which leaves the last good
# file in place and the board a few hours behind rather than empty.
[ -s "$TMP" ] || exit 0
chmod 644 "$TMP"
mv "$TMP" "$OUT/streak.json"
