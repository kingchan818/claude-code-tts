import { describe, expect, test } from 'claude-code/testing'

import { parseSpeed, stepSpeed, toChunks as chunk, toSpeech } from '../hooks/speech'

describe('toSpeech', () => {
  test('drops code blocks, links, markdown marks and emoji', async () => {
    const reply = [
      '## Q1: warm-up 🎉',
      '',
      '- **Correct!** See [the docs](https://pkg.go.dev/time).',
      '',
      '```go',
      'fmt.Println("hi")',
      '```',
      '',
      'Use `10 * time.Millisecond` → done.',
    ].join('\n')

    expect(toSpeech(reply)).toBe(
      'Q1: warm-up\nCorrect! See the docs.\n(code block)\nUse 10 * time.Millisecond to done.',
    )
  })

  test('skips pipe tables', async () => {
    const reply = 'Before.\n\n| Buffer | Alive |\n|---|---|\n| 1 | 1 |\n\nAfter.'
    expect(toSpeech(reply)).toBe('Before.\n(table)\nAfter.')
  })

  test('skips box-drawing tables', async () => {
    const reply = [
      '┌────────────┬──────────────┬────────────┐',
      '│    Task    │ F1 Microsoft │ F1 JEV API │',
      '├────────────┼──────────────┼────────────┤',
      '│ restricted │ 98.5         │ 99.6       │',
      '├────────────┼──────────────┼────────────┤',
      '│ jailbreak  │ 100.0        │ 100.0      │',
      '└────────────┴──────────────┴────────────┘',
    ].join('\n')
    expect(toSpeech(reply)).toBe('(table)')
  })

  test('skips shell commands that are not fenced', async () => {
    const reply = [
      'Check one region, for example East Asia (Hong Kong):',
      'az cognitiveservices model list -l eastasia \\',
      '  --query "[?contains(model.name,\'Decision\')].{model:model.name}" -o table',
      '',
      'Check every region, which takes a few minutes:',
      'for r in $(az account list-locations -o tsv); do',
      '  s=$(az cognitiveservices model list -l "$r" -o tsv 2>/dev/null | sort -u)',
      '  [ -n "$s" ] && echo "$r: $s"',
      'done',
    ].join('\n')
    expect(toSpeech(reply)).toBe(
      'Check one region, for example East Asia (Hong Kong):\n(code block)\nCheck every region, which takes a few minutes:\n(code block)',
    )
  })

  test('skips fenced code, even when the fence is never closed', async () => {
    expect(toSpeech('Run it:\n```sh\naz login')).toBe('Run it:\n(code block)')
  })

  test('cuts very long replies', async () => {
    expect(toSpeech('word '.repeat(2000), 100).length).toBeLessThan(160)
  })
})

describe('parseSpeed', () => {
  test('reads 1.4, 2 and 1.2x, and rejects out-of-range or junk', async () => {
    expect(parseSpeed('1.4')).toBe(1.4)
    expect(parseSpeed('2')).toBe(2)
    expect(parseSpeed('1.2x')).toBe(1.2)
    expect(parseSpeed('5')).toBeUndefined()
    expect(parseSpeed('fast')).toBeUndefined()
  })
})

describe('stepSpeed', () => {
  test('moves by one step and stays between 0.5 and 3', async () => {
    expect(stepSpeed(1, 0.25)).toBe(1.25)
    expect(stepSpeed(1.25, -0.25)).toBe(1)
    expect(stepSpeed(0.5, -0.25)).toBe(0.5)
    expect(stepSpeed(3, 0.25)).toBe(3)
  })
})

describe('toChunks', () => {
  test('keeps the first piece short and never loses words', async () => {
    const { toChunks } = await Promise.resolve({ toChunks: chunk })
    const text = 'One. '.repeat(100).trim()
    const chunks = toChunks(text)
    expect(chunks[0]!.length).toBeLessThanOrEqual(200)
    expect(chunks.join(' ')).toBe(text)
  })
})
