#!/usr/bin/env bash
set -euo pipefail

: "${BUILD_ID:?No build. Check the build or repack job of this run.}"
: "${PLATFORM:?No platform. Set PLATFORM to android or ios in the lane job.}"
: "${FLOW:?No flow. Set FLOW to the name of a file in .eas/qa-flows.}"

FLOW_FILE=".eas/qa-flows/$FLOW.$PLATFORM.md"
[ -f "$FLOW_FILE" ] || FLOW_FILE=".eas/qa-flows/$FLOW.md"
[ -f "$FLOW_FILE" ] || { echo "No flow file for $FLOW. Add .eas/qa-flows/$FLOW.md." >&2; exit 1; }

source .eas/agents/start-session.sh "$PLATFORM" "$BUILD_ID" "QA Swarm: $PLATFORM $FLOW" qa-swarm

{
  cat .eas/agents/qa-lane.md
  printf '\n## Flow\n\n'
  cat "$FLOW_FILE"
  printf '\n'
  cat agent-output/device.md
} > agent-output/prompt.md

env -u EXPO_TOKEN -u EXPO_TOKEN_SIMULATOR -u GITHUB_TOKEN \
  timeout 15m bash .eas/agents/run-agent.sh agent-output/prompt.md device || true

[ -s agent-output/evidence/verdict.md ] || echo 'FAIL: The agent did not write a verdict.' > agent-output/evidence/verdict.md
VERDICT=$(head -n 1 agent-output/evidence/verdict.md)

SITE_URL=$(env -u EXPO_TOKEN_SIMULATOR -u GITHUB_TOKEN -u CLAUDE_CODE_OAUTH_TOKEN -u ANTHROPIC_API_KEY \
  -u CODEX_API_KEY -u CURSOR_API_KEY -u XAI_API_KEY \
  npx --yes eas-simulator-evidence@0.2.4 run agent-output/evidence --stop \
  --subject "QA Swarm: $PLATFORM $FLOW" --verdict-file agent-output/evidence/verdict.md \
  --build-id "$BUILD_ID" --deploy-alias "qa-$PLATFORM-$FLOW-evidence" | tail -n 1)

set-output verdict "$VERDICT"
set-output site_url "$SITE_URL"

case "$VERDICT" in
  PASS:*) exit 0 ;;
  *) exit 1 ;;
esac
