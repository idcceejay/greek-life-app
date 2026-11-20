#!/usr/bin/env bash
set -euo pipefail

: "${ISSUE_NUMBER:?No issue number. Pass -F issue_number=<number>.}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN is not set. Add it to the preview environment.}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is not set. Add it to the preview environment.}"

PROJECT_DIR=$(pwd)
REPO_DIR=$(git rev-parse --show-toplevel)
APP_PATH=$(git rev-parse --show-prefix)
WORK_DIR=/tmp/agent-change
APP_DIR="$WORK_DIR/$APP_PATH"
BRANCH="agent/issue-$ISSUE_NUMBER"
GITHUB_HELPER="$PROJECT_DIR/.eas/agents/github.mjs"
PUSH_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"

git clone --depth 1 "$PUSH_URL" "$WORK_DIR"
git -C "$WORK_DIR" remote set-url origin "https://github.com/${GITHUB_REPOSITORY}.git"
ln -s "$REPO_DIR/node_modules" "$WORK_DIR/node_modules"
printf 'node_modules\nagent-output/\n' >> "$WORK_DIR/.git/info/exclude"
mkdir -p "$APP_DIR/agent-output"

{
  cat .eas/agents/make-change.md
  printf '\n## Issue #%s\n\n' "$ISSUE_NUMBER"
  node "$GITHUB_HELPER" issue "$ISSUE_NUMBER"
} > "$APP_DIR/agent-output/prompt.md"

cd "$APP_DIR"
env -u EXPO_TOKEN -u EXPO_TOKEN_SIMULATOR -u GITHUB_TOKEN \
  timeout 20m bash .eas/agents/run-agent.sh agent-output/prompt.md change || true

if [ -n "$(git -C "$WORK_DIR" status --porcelain -- "${APP_PATH}.eas" .github)" ]; then
  echo "The agent changed files in .eas or .github. The job does not open a pull request." >&2
  exit 1
fi

if [ -z "$(git status --porcelain)" ]; then
  {
    printf '## Issue to PR\n\nThe agent did not change any file.\n\n'
    cat agent-output/summary.md 2> /dev/null || true
  } > /tmp/comment.md
  node "$GITHUB_HELPER" comment "$ISSUE_NUMBER" /tmp/comment.md
  exit 1
fi

TITLE=$(head -n 1 agent-output/summary.md 2> /dev/null || true)
TITLE=${TITLE:-"Change for issue #$ISSUE_NUMBER"}
{
  tail -n +2 agent-output/summary.md 2> /dev/null || true
  printf '\n\nCloses #%s\n' "$ISSUE_NUMBER"
} > /tmp/pull-request.md

AUTHOR_EMAIL=$(node "$GITHUB_HELPER" author-email)
git checkout -b "$BRANCH"
git add -A
git -c user.name="Expo agent" -c user.email="$AUTHOR_EMAIL" commit -m "$TITLE"
git push --force "$PUSH_URL" "HEAD:refs/heads/$BRANCH"
PR_URL=$(node "$GITHUB_HELPER" open-pull-request "$BRANCH" "$TITLE" /tmp/pull-request.md)

printf '## Issue to PR\n\nThe agent opened %s.\n' "$PR_URL" > /tmp/comment.md
node "$GITHUB_HELPER" comment "$ISSUE_NUMBER" /tmp/comment.md
