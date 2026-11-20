#!/usr/bin/env bash
set -euo pipefail

case "$2" in
  device) tools='Read,Glob,Grep,Write,Bash(npx --yes eas-cli@latest simulator:exec npx --yes agent-device@latest *),Bash(npx --yes -p @swmansion/argent@latest argent *)' ;;
  change) tools='Read,Glob,Grep,Edit,Write,Bash(npx tsc --noEmit)' ;;
  *)
    echo "Unknown mode \"$2\". Use device or change." >&2
    exit 1
    ;;
esac

mkdir -p agent-output/evidence
npx --yes @anthropic-ai/claude-code@latest -p "Do the task that standard input describes." \
  --allowedTools "$tools" --permission-mode dontAsk --max-turns 80 \
  --output-format stream-json --verbose < "$1" > agent-output/evidence/agent-log.jsonl || {
  tail -n 1 agent-output/evidence/agent-log.jsonl >&2
  exit 1
}
