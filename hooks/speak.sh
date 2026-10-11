#!/bin/bash
# usage: speak.sh SPEED SAY_WPM TEXT BODY_JSON...
# Plays the reply with ElevenLabs (via OpenRouter) when a key is saved, one
# piece at a time: piece N plays while piece N+1 is fetched. Falls back to
# the built-in macOS `say` voice when there is no key or the first piece fails.
speed=$1
wpm=$2
text=$3
shift 3
bodies=("$@")

keyfile="$HOME/.config/read-aloud/openrouter_key"
log="${TMPDIR:-/tmp}/read-aloud.log"
note() { echo "$(date "+%F %T") $*" >> "$log"; }
note "start speed=$speed chars=${#text} pieces=${#bodies[@]}"

fallback() { exec say -r "$wpm" -- "$text"; }

[ -s "$keyfile" ] || { note "no key file, using say"; fallback; }
key=$(tr -d '[:space:]' < "$keyfile")
dir=$(mktemp -d "${TMPDIR:-/tmp}/read-aloud.XXXXXX")
trap 'rm -rf "$dir"' EXIT

# Fetches piece $1 into $dir/$1.mp3; the key goes through stdin, never `ps`.
fetch() {
  printf 'header = "Authorization: Bearer %s"\n' "$key" |
    curl -sf --max-time 60 -K - \
      -H "Content-Type: application/json" \
      --data-binary "${bodies[$1]}" \
      -o "$dir/$1.mp3" \
      https://openrouter.ai/api/v1/audio/speech
}

fetch 0 &
pid=$!
for ((i = 0; i < ${#bodies[@]}; i++)); do
  if ! wait "$pid"; then
    note "elevenlabs failed on piece $i"
    [ "$i" -eq 0 ] && { rm -rf "$dir"; fallback; }
    exit 1
  fi
  next=$((i + 1))
  if [ "$next" -lt "${#bodies[@]}" ]; then
    fetch "$next" &
    pid=$!
  fi
  note "playing piece $i"
  afplay -r "$speed" -q 1 "$dir/$i.mp3" || { note "afplay stopped: $?"; exit 0; }
done
note "done"
