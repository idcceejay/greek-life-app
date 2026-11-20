#!/usr/bin/env bash

case "$1" in
  android) APP_ID_KEY=package ;;
  ios) APP_ID_KEY=bundleIdentifier ;;
  *)
    echo "Unknown platform \"$1\". Use android or ios." >&2
    exit 1
    ;;
esac
APP_ID=$(npx expo config --json | node -e 'const config = JSON.parse(require("fs").readFileSync(0, "utf8")); console.log(config[process.argv[1]]?.[process.argv[2]] ?? "")' "$1" "$APP_ID_KEY")
: "${APP_ID:?The app config has no app ID for $1. Add it to app.json or app.config.js.}"
mkdir -p agent-output/evidence

export EXPO_TOKEN="$EXPO_TOKEN_SIMULATOR"
npx --yes eas-cli@latest simulator:start --platform "$1" --type agent-device \
  --build-id "$2" --name "$3" --tag "$4" \
  --max-duration-minutes 30 --json > /tmp/session.json
trap 'npx --yes eas-cli@latest simulator:stop --non-interactive > /dev/null 2>&1 || true' EXIT

npx --yes eas-cli@latest simulator:exec npx --yes agent-device@latest open "$APP_ID" --platform "$1" > /dev/null

cat > agent-output/device.md << EOF
## Device

- Platform: $1
- App ID: $APP_ID

Control the device only with this shell command:

    npx --yes eas-cli@latest simulator:exec npx --yes agent-device@latest <command>

Run each command alone. Do not join commands with ;, &&, or |. The folder agent-output/evidence already exists. If a command is denied, run it again alone one time before you stop. Write files, such as the verdict, with your file tools, not with shell commands.

Use these agent-device commands:

- snapshot -i lists the elements on the screen, with references such as @e2. The references change on each screen, so run snapshot -i again after each action.
- snapshot without -i also lists the plain text on the screen.
- press @e2 taps an element.
- fill @e4 "text" types text into a field.
- keyboard enter presses the Enter key of the keyboard.
- scroll down scrolls the screen.
- screenshot agent-output/evidence/<number>-<name>.png saves a screenshot.
- open $APP_ID --platform $1 opens the app again.
EOF

if [ -f .eas/agents/app-facts.md ]; then
  printf '\n## App facts\n\n' >> agent-output/device.md
  cat .eas/agents/app-facts.md >> agent-output/device.md
fi
