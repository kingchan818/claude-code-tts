# claude-code-tts

**Text-to-speech for Claude Code.** A plugin that reads Claude's replies out loud on macOS, with natural ElevenLabs voices.

> Unofficial community plugin. Not affiliated with Anthropic or ElevenLabs.

- Uses **ElevenLabs `eleven-v4-turbo`** through [OpenRouter](https://openrouter.ai/elevenlabs/eleven-v4-turbo) when you save a key.
- Falls back to the built-in macOS `say` voice when there is no key, or when the request fails.
- Skips code blocks, links, markdown symbols, tables and emoji, so it sounds natural.
- Stops talking as soon as you send a new message.

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
| `/speak rate N` | Speed of the macOS fallback voice, words per minute (default 175) |

## Requirements

- macOS (`say`, `afplay`, `curl`)
- Claude Code with function-hook plugins

## Develop

```sh
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```

## License

[MIT](LICENSE)
