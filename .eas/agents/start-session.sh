#!/usr/bin/env bash

case "$1" in
  android) APP_ID_KEY=package; SCALE=0.9 ;;
  ios) APP_ID_KEY=bundleIdentifier; SCALE=1 ;;
  *)
    echo "Unknown platform \"$1\". Use android or ios." >&2
    exit 1
    ;;
esac
APP_ID=$(npx expo config --json | node -e 'const config = JSON.parse(require("fs").readFileSync(0, "utf8")); console.log(config[process.argv[1]]?.[process.argv[2]] ?? "")' "$1" "$APP_ID_KEY")
: "${APP_ID:?The app config has no app ID for $1. Add it to app.json or app.config.js.}"
mkdir -p agent-output/evidence

export EXPO_TOKEN="$EXPO_TOKEN_SIMULATOR"
npx --yes eas-cli@latest simulator:start --platform "$1" --type argent \
  --build-id "$2" --name "$3" --tag "$4" \
  --max-duration-minutes 30 --json > /tmp/session.json
trap 'npx --yes eas-cli@latest simulator:stop --non-interactive > /dev/null 2>&1 || true' EXIT

set -a
source ./.env.eas-simulator
set +a

UDID=""
for attempt in 1 2 3 4; do
  UDID=$(npx --yes -p @swmansion/argent@latest argent run list-devices 2> /dev/null \
    | grep -oE '"(udid|serial)" *: *"[^"]+"' | head -n 1 | sed -E 's/.*"([^"]+)"$/\1/' || true)
  [ -n "$UDID" ] && break
  sleep 15
done
: "${UDID:?Argent did not list a device. See the logs of this job.}"

cat > agent-output/device.md << EOF
## Device

- Platform: $1
- App ID: $APP_ID
- Device ID: $UDID

Control the device only with this shell command:

    npx --yes -p @swmansion/argent@latest argent run <tool> --udid $UDID <options>

Run each command alone. Do not join commands with ;, &&, or |. The folder agent-output/evidence already exists. If a command is denied, run it again alone one time before you stop. Write files, such as the verdict, with your file tools, not with shell commands.

Use these Argent tools:

- describe lists the elements on the screen. Each element has a frame in coordinates from 0 to 1.
- gesture-tap --x <x> --y <y> taps a point. Use the center of the frame of an element from describe. Never use pixels. Run describe again after each change on the screen.
- keyboard --text "text" types text into the field that has focus.
- gesture-swipe --fromX 0.5 --fromY 0.7 --toX 0.5 --toY 0.3 scrolls the screen down.
- screenshot --scale $SCALE --out agent-output/evidence/<number>-<name>.png saves a screenshot.
- restart-app --bundleId $APP_ID opens the app again.
EOF

if [ -f .eas/agents/app-facts.md ]; then
  printf '\n## App facts\n\n' >> agent-output/device.md
  cat .eas/agents/app-facts.md >> agent-output/device.md
fi
