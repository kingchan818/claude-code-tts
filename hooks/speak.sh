#!/bin/sh
# usage: speak.sh SPEED SAY_WPM BODY_JSON TEXT
# Plays the reply with ElevenLabs (via OpenRouter) when a key is saved,
# otherwise falls back to the built-in macOS `say` voice.
speed=$1
wpm=$2
body=$3
text=$4
keyfile="$HOME/.config/read-aloud/openrouter_key"

if [ -s "$keyfile" ]; then
  out="${TMPDIR:-/tmp}/read-aloud-$$.mp3"
  key=$(tr -d '[:space:]' < "$keyfile")
  # The key goes through stdin, so it never shows up in `ps`.
  if printf 'header = "Authorization: Bearer %s"\n' "$key" |
    curl -sf --max-time 60 -K - \
      -H "Content-Type: application/json" \
      --data-binary "$body" \
      -o "$out" \
      https://openrouter.ai/api/v1/audio/speech; then
    afplay -r "$speed" -q 1 "$out"
    rm -f "$out"
    exit 0
  fi
  rm -f "$out"
fi

exec say -r "$wpm" -- "$text"
