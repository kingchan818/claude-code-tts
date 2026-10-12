# claude-code-tts

**Text-to-speech for Claude Code.** A plugin that reads Claude's replies out loud on macOS, with natural ElevenLabs voices.

> Unofficial community plugin. Not affiliated with Anthropic or ElevenLabs.

- Uses **ElevenLabs `eleven-v4-turbo`** through [OpenRouter](https://openrouter.ai/elevenlabs/eleven-v4-turbo) when you save a key.
- Falls back to the built-in macOS `say` voice when there is no key, or when the request fails.
- Skips code blocks, shell commands, links, markdown symbols, tables (pipe or box-drawing) and emoji, so it sounds natural. A skipped table or code block is spoken as just "table" or "code block".
- Stops talking as soon as you send a new message.
- Shows a small bar above the prompt while it works (`🔊 Preparing voice…`, `🔊 Speaking 2 of 3`) with **Stop**, **Play again** (stays after the reply is read) and **−** / **+** speed buttons, which take effect from the next piece.
- Speaks in pieces, so the first words start in a few seconds even for long replies.

Made for people who prefer listening to reading, for example learners with dyslexia.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install read-aloud --marketplace kingchan818/claude-code-tts
```

Answer `y` to add the marketplace, then pick a scope.

## Use ElevenLabs (optional)

Copy your OpenRouter API key, then in a normal terminal:

```sh
mkdir -p ~/.config/read-aloud
pbpaste > ~/.config/read-aloud/openrouter_key
chmod 600 ~/.config/read-aloud/openrouter_key
```

The key is read from that file and passed to `curl` on stdin, so it never appears in a process list.
ElevenLabs bills per character; replies are cut at about 4,000 characters.

## Commands

| Command | What it does |
|---|---|
| `/speak` | Turn reading aloud on or off |
| `/speak on` / `/speak off` | Turn it on or off |
| `/speak stop` | Stop the current reading |
| `/speak again` | Read the last reply again |
| `/speak voice NAME` | ElevenLabs voice: george (default), sarah, adam, alice, bella, bill, brian, callum, charlie, chris, daniel, eric, harry, jessica, laura, liam, lily, matilda, river, roger, will |
| `/speak 1.4` | Speed, from `0.5` to `3` (default `1`). `/speak speed` shows the current one |

## Requirements

- **Claude Code 2.1.296 or newer.** It uses function-hook plugins, an early-access API that may change between releases. Check yours with `claude --version`, and update with `claude update`.
- macOS (`say`, `afplay`, `curl`, `bash`)
- Optional: an [OpenRouter](https://openrouter.ai) API key for ElevenLabs voices

## Develop

```sh
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```

## License

[MIT](LICENSE)
