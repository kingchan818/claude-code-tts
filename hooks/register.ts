import type { EngineInterface, Register } from 'claude-code'

import { toSpeech } from './speech'

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
  '/speak rate N     macOS fallback speed, words per minute (default 175)',
].join('\n')

let lastReply = ''

async function isEnabled($: EngineInterface): Promise<boolean> {
  return ((await $.store.get('enabled')) ?? true) === true
}

async function stopSpeaking($: EngineInterface): Promise<void> {
  await $.process.run(['pkill', '-f', `${$.plugin.root}/hooks/speak.sh`]).catch(() => undefined)
  await $.process.run(['pkill', '-x', 'afplay']).catch(() => undefined)
  await $.process.run(['pkill', '-x', 'say']).catch(() => undefined)
}

// Starts the speak script in the background so the hook returns at once.
async function speak($: EngineInterface, text: string): Promise<void> {
  if (text === '') return
  await stopSpeaking($)
  const voice = String((await $.store.get('voice')) ?? 'george')
  const rate = String((await $.store.get('rate')) ?? 175)
  const body = JSON.stringify({ model: MODEL, input: text, voice, response_format: 'mp3' })
  await $.process.run([
    '/bin/sh',
    '-c',
    '"$1" "$2" "$3" "$4" >/dev/null 2>&1 &',
    'speak',
    `${$.plugin.root}/hooks/speak.sh`,
    rate,
    body,
    text,
  ])
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'speak',
      description: 'Read Claude replies aloud: on, off, stop, again, voice NAME, rate N',
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
      case 'rate': {
        const n = Number(value)
        if (!Number.isInteger(n) || n < 80 || n > 400) return { text: 'Use a number from 80 to 400, e.g. /speak rate 160' }
        await $.store.set('rate', n)
        return { text: `Fallback speed set to ${n} words per minute.` }
      }
      default:
        return { text: HELP }
    }
  })
}
