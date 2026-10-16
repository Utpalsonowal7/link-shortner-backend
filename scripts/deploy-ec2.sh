#!/usr/bin/env bash
# Called as ubuntu by SSM, from /home/ubuntu/apps/link-shortner-backend.
set -euo pipefail
revision="${1:?Usage: deploy-ec2.sh COMMIT_SHA}"
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid commit SHA" >&2; exit 1; }
exec 9>.git/ec2-deploy.lock
flock -w 1800 9
git fetch --no-tags origin main
if [[ "$(git rev-parse origin/main)" != "$revision" ]]; then
  echo "Skipping superseded commit $revision; main has moved."
  exit 0
fi
git diff --quiet && git diff --cached --quiet || {
  echo "Tracked files have local changes; refusing to overwrite them." >&2
  exit 1
}
test -s .env || { echo "Configure the server .env first." >&2; exit 1; }
git checkout --detach "$revision"
export DEPLOY_SHA="$revision"
compose=(sudo -n docker compose -p link-shortner-backend -f compose.ec2.yaml)
"${compose[@]}" config --quiet
# Build before replacing the running API. Build or migration failure leaves it running.
"${compose[@]}" build api migrate
"${compose[@]}" up -d --wait --wait-timeout 90 redis
"${compose[@]}" run --rm --no-deps migrate
"${compose[@]}" up -d --no-deps --wait --wait-timeout 120 api
curl --fail --silent --show-error --retry 6 --retry-connrefused \
  --retry-delay 5 --connect-timeout 5 --max-time 10 \
  http://127.0.0.1:8080/health-check >/dev/null
printf '%s\n' "$revision" > .git/ec2-last-success
echo "Successfully deployed $revision"
# No down, volume deletion, automatic migration rollback, or image pruning.
# Keep the previous images for manual recovery; monitor disk usage.
