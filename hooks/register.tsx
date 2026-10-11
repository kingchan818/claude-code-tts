import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import { parseSpeed, toChunks, toSpeech } from './speech'

const MODEL = 'elevenlabs/eleven-v4-turbo'
const VOICES = [
  'george', 'sarah', 'adam', 'alice', 'bella', 'bill', 'brian', 'callum', 'charlie', 'chris', 'daniel',
  'eric', 'harry', 'jessica', 'laura', 'liam', 'lily', 'matilda', 'river', 'roger', 'will',
]

const HELP = [
  '/speak            turn reading aloud on or off',
  '/speak on|off     turn it on or off',
  '/speak stop       stop the current reading',
  '/speak again      read the last reply again',
  '/speak voice NAME ElevenLabs voice (george, sarah, lily, ...)',
  '/speak 1.4        speed from 0.5 to 3 (default 1)',
].join('\n')

// The speak script writes its progress here; the band above the prompt shows it.
const STATUS_FILE = '/tmp/read-aloud.status'
const status = atom({ plugin: 'read-aloud', key: 'status' } as const, '')

let lastReply = ''
let poll: Timer | undefined

// Copies the script's progress into the band until it goes idle.
function watchStatus($: EngineInterface): void {
  poll?.cancel()
  poll = $.clock.every(300, () => {
    void (async () => {
      const text = (await $.fs.read(STATUS_FILE).catch(() => '')).trim()
      if (text !== (await read($, status))) await update($, status, () => text)
      if (text === '' && (await $.clock.now()) - startedAt > 3000) {
        poll?.cancel()
        poll = undefined
      }
    })()
  })
}

let startedAt = 0

async function isEnabled($: EngineInterface): Promise<boolean> {
  return ((await $.store.get('enabled')) ?? true) === true
}

async function stopSpeaking($: EngineInterface): Promise<void> {
  await $.process.run(['pkill', '-f', `${$.plugin.root}/hooks/speak.sh`]).catch(() => undefined)
  await $.process.run(['pkill', '-x', 'afplay']).catch(() => undefined)
  await $.process.run(['pkill', '-x', 'say']).catch(() => undefined)
  await $.fs.write(STATUS_FILE, '').catch(() => undefined)
  await update($, status, () => '')
}

async function getSpeed($: EngineInterface): Promise<number> {
  return Number((await $.store.get('speed')) ?? 1)
}

// Starts the speak script in the background so the hook returns at once.
async function speak($: EngineInterface, text: string): Promise<void> {
  if (text === '') return
  await stopSpeaking($)
  const voice = String((await $.store.get('voice')) ?? 'george')
  const speed = await getSpeed($)
  const bodies = toChunks(text).map(input => JSON.stringify({ model: MODEL, input, voice, response_format: 'mp3' }))
  await $.process.run([
    '/bin/sh',
    '-c',
    '"$@" >/dev/null 2>&1 &',
    'speak',
    `${$.plugin.root}/hooks/speak.sh`,
    STATUS_FILE,
    String(speed),
    String(Math.round(175 * speed)), // macOS say: words per minute
    text,
    ...bodies,
  ])
  startedAt = await $.clock.now()
  watchStatus($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'speak',
      description: 'Read Claude replies aloud: on, off, stop, again, voice NAME, 1.4',
    })
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined || e.isAborted) return done // main replies only
    lastReply = e.answer
    if (await isEnabled($)) {
      await speak($, toSpeech(e.answer)).catch(err => $.ui.log(`speak failed: ${err}`, { to: 'debug' }))
    }
    return done
  })

  // A new prompt stops the old reading.
  on('prompt.submit', async ($, e, next) => {
    await stopSpeaking($)
    return next(e)
  }).catch(($, e, next) => next(e)) // never block a prompt

  // A small bar above the prompt while the voice is preparing or speaking.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const text = await read($, status)
    if (text === '' || e.props.hasSurvey) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box>
        <Text color="cyan">🔊 {text} </Text>
        <Button key="stop" label="Stop" onPress={() => stopSpeaking($)} />
      </Box>
    )
  })

  on('command.run', { command: 'speak' }, async ($, e) => {
    const [word = '', value = ''] = e.args.trim().toLowerCase().split(/\s+/)

    switch (word) {
      case '': {
        const enabled = !(await isEnabled($))
        await $.store.set('enabled', enabled)
        if (!enabled) await stopSpeaking($)
        return { text: `Reading aloud is ${enabled ? 'on' : 'off'}.` }
      }
      case 'on':
      case 'off':
        await $.store.set('enabled', word === 'on')
        if (word === 'off') await stopSpeaking($)
        return { text: `Reading aloud is ${word}.` }
      case 'stop':
        await stopSpeaking($)
        return { text: 'Stopped.' }
      case 'again':
        if (lastReply === '') return { text: 'No reply to read yet.' }
        await speak($, toSpeech(lastReply))
        return { text: 'Reading the last reply again.' }
      case 'voice':
        if (!VOICES.includes(value)) return { text: `Pick one of: ${VOICES.join(', ')}` }
        await $.store.set('voice', value)
        return { text: `Voice set to ${value}.` }
      case 'speed': {
        if (value === '') return { text: `Speed is ${await getSpeed($)}x. Try /speak 1.4` }
        const n = parseSpeed(value)
        if (n === undefined) return { text: 'Use a speed from 0.5 to 3, e.g. /speak 1.4' }
        await $.store.set('speed', n)
        return { text: `Speed set to ${n}x.` }
      }
      default: {
        // `/speak 1.4` is a shortcut for `/speak speed 1.4`
        const n = parseSpeed(word)
        if (n === undefined) return { text: HELP }
        await $.store.set('speed', n)
        return { text: `Speed set to ${n}x.` }
      }
    }
  })
}
