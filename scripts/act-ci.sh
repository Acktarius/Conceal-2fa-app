#!/usr/bin/env bash
# Run GitHub Actions workflows locally with act (https://nektos.github.io/act/).
# Requires: Docker running, act on PATH (~/.local/bin after install).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v act >/dev/null 2>&1; then
  echo "act not found. Install:" >&2
  echo "  curl -fsSL https://raw.githubusercontent.com/nektos/act/master/install.sh | bash -s -- -b ~/.local/bin" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running or not accessible." >&2
  exit 1
fi

usage() {
  cat <<'EOF'
Usage: scripts/act-ci.sh [command]

Commands:
  ci          Run .github/workflows/ci-check.yml (default)
  security    Run security-check jobs that work offline (npm-audit, secret-scan)
  all         ci + security (skips PR-only dependency-review)
  list        act -l for both workflows
  dry-run     List steps without running (ci-check)

Examples:
  scripts/act-ci.sh
  scripts/act-ci.sh security
  scripts/act-ci.sh dry-run

Notes:
  - Uses repo .actrc (medium runner image). First run pulls ~500MB Docker image.
  - Copies repo into container (no --bind / no extra -v mounts).
  - Does not load host .env or .secrets into the container.
  - dependency-review only runs on pull_request on GitHub — not replayed locally.
  - Gitleaks may warn without GITHUB_TOKEN; set ACT_GITHUB_TOKEN if needed.
  - Optional tighter network: ACT_NETWORK=bridge npm run ci:act
EOF
}

run_act() {
  filter_act_args "$@"
  act "$@"
}

EVENT="${ACT_EVENT:-push}"
# Security-oriented defaults (see README4DEVS.md § act security):
# - no --bind: act copies the repo into the container (no host directory bind mount)
# - no --privileged
# - do not auto-load host .env or .secrets into the container
ACT_ARGS=(
  --rm
  --env-file /dev/null
  --secret-file /dev/null
)
if [[ -n "${ACT_NETWORK:-}" ]]; then
  ACT_ARGS+=(--network "$ACT_NETWORK")
fi

filter_act_args() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      -b | --bind)
        echo "Refusing --bind: would bind-mount the repo from the host into the container." >&2
        echo "act-ci.sh uses act copy mode instead (safer)." >&2
        exit 1
        ;;
      -v | --volume | --mount)
        echo "Refusing extra Docker volume mount: $arg" >&2
        exit 1
        ;;
    esac
  done
}
run_ci() {
  run_act "$EVENT" -W .github/workflows/ci-check.yml "${ACT_ARGS[@]}" "$@"
}

run_security() {
  run_act "$EVENT" -W .github/workflows/security-check.yml -j npm-audit "${ACT_ARGS[@]}" "$@"
  run_act "$EVENT" -W .github/workflows/security-check.yml -j secret-scan \
    --env GITHUB_TOKEN="${ACT_GITHUB_TOKEN:-local-act-token}" \
    "${ACT_ARGS[@]}" "$@"
}

cmd="${1:-ci}"
shift || true

case "$cmd" in
  ci)
    run_ci "$@"
    ;;
  security)
    run_security "$@"
    ;;
  all)
    run_ci "$@"
    run_security "$@"
    ;;
  list)
    act -l -W .github/workflows/ci-check.yml
    act -l -W .github/workflows/security-check.yml
    ;;
  dry-run)
    run_act "$EVENT" -W .github/workflows/ci-check.yml -n "${ACT_ARGS[@]}" "$@"
    ;;
  -h | --help | help)
    usage
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    usage >&2
    exit 1
    ;;
esac
