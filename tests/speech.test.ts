import { describe, expect, test } from 'claude-code/testing'

import { parseSpeed, toSpeech } from '../hooks/speech'

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

  test('turns tables into spoken rows', async () => {
    const reply = '| Buffer | Alive |\n|---|---|\n| 1 | 1 |'
    expect(toSpeech(reply)).not.toContain('|')
    expect(toSpeech(reply)).not.toContain('---')
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
