#!/usr/bin/env bash
set -euo pipefail

: "${BUILD_ID:?No simulator build. Check the build or repack job of this run.}"
: "${ISSUE_NUMBER:?No issue number. Check the intake job, or pass -F issue_number=<number>.}"
: "${PLATFORM:?No platform. Set PLATFORM to android or ios in the reproduce job.}"

node .eas/agents/github.mjs issue "$ISSUE_NUMBER" > /tmp/issue.json
source .eas/agents/start-session.sh "$PLATFORM" "$BUILD_ID" "Issue #$ISSUE_NUMBER triage" bug-triage

{
  cat .eas/agents/reproduce.md
  printf '\n## Bug report\n\n'
  cat /tmp/issue.json
  printf '\n'
  cat agent-output/device.md
} > agent-output/prompt.md

env -u EXPO_TOKEN -u EXPO_TOKEN_SIMULATOR -u GITHUB_TOKEN \
  timeout 20m bash .eas/agents/run-agent.sh agent-output/prompt.md device || true

VERDICT=$(head -n 1 agent-output/evidence/verdict.md 2> /dev/null || true)
PLATFORM_NAME=$([ "$PLATFORM" = ios ] && echo iOS || echo Android)
VERDICT=${VERDICT:-"INCONCLUSIVE: The agent did not write a verdict. See the logs of this run."}
SESSION_URL=$(node -p 'require("/tmp/session.json").deviceRunSessionUrl')

{
  printf '## Bug triage (%s)\n\n**Verdict:** %s\n\n' "$PLATFORM_NAME" "$VERDICT"
  printf -- '- [Session recording](%s)\n' "$SESSION_URL"
  printf -- '- [Agent report and screenshots](%s)\n\n' "$RUN_URL"
  printf '<details>\n<summary>Report</summary>\n\n'
  tail -n +2 agent-output/evidence/verdict.md 2> /dev/null || true
  printf '\n</details>\n'
  case "$VERDICT" in
    REPLICATED:*) printf '\nTo start Issue to PR, read the report, then add the `agent` label.\n' ;;
  esac
} > /tmp/comment.md
node .eas/agents/github.mjs comment "$ISSUE_NUMBER" /tmp/comment.md
