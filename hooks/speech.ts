// Tables and shell commands are never read out; each one becomes a short marker.
const TABLE_LINE = /^\s*[|│┃┌┐└┘├┤┬┴┼┏┓┗┛┣┫┳┻╋╭╮╯╰╔╗╚╝╠╣╦╩╬─━═]/
const TABLE_SEPARATOR = /^\s*\|?(\s*:?-+:?\s*\|)+(\s*:?-+:?)?\s*$/
const COMMAND =
  /^\s*(?:\$\s+|[A-Z_]+=\S*\s+)?(?:az|aws|gcloud|git|npm|npx|pnpm|yarn|bun|docker|kubectl|helm|terraform|curl|brew|pip3?|python3?|node|cd|ls|cat|echo|export|sudo|mkdir|chmod|claude|make)\s+\S/
const COMMAND_SHAPE = /\s-{1,2}[A-Za-z]|\$\(|\$\{|&&|\|\||\s\|\s|\\\s*$/

// Finds table rows and unfenced shell commands (fenced code is handled by the caller).
function blockKinds(lines: string[]): Array<'table' | 'code' | undefined> {
  const kinds: Array<'table' | 'code' | undefined> = lines.map(() => undefined)

  lines.forEach((line, i) => {
    if (TABLE_LINE.test(line)) {
      kinds[i] = 'table'
    } else if (TABLE_SEPARATOR.test(line)) {
      kinds[i] = 'table'
      if (i > 0 && lines[i - 1]!.includes('|')) kinds[i - 1] = 'table' // header row without a leading |
      for (let j = i + 1; j < lines.length && lines[j]!.includes('|'); j++) kinds[j] = 'table'
    }
  })

  let inLoop = false // between `for ...; do` and `done`
  let continued = false // previous line ended with a backslash
  lines.forEach((line, i) => {
    if (line.trim() === '') inLoop = false
    if (kinds[i] !== undefined) {
      continued = false
      return
    }
    if (/^\s*(?:for|while|if)\b.*;\s*(?:do|then)\b/.test(line) && !/;\s*(?:done|fi)\b/.test(line)) inLoop = true
    const isCode =
      inLoop ||
      continued ||
      /^\s*\$\s+\S/.test(line) ||
      (COMMAND.test(line) && COMMAND_SHAPE.test(line)) ||
      (kinds[i - 1] === 'code' && /^\s+-{1,2}[A-Za-z]/.test(line))
    if (isCode) kinds[i] = 'code'
    if (/^\s*(?:done|fi)\b/.test(line)) inLoop = false
    continued = isCode && /\\\s*$/.test(line)
  })
  return kinds
}

function dropTablesAndCommands(text: string): string {
  const lines = text.split('\n')
  const kinds = blockKinds(lines)
  const out: string[] = []
  lines.forEach((line, i) => {
    const kind = kinds[i]
    if (kind === undefined) out.push(line)
    else if (kinds[i - 1] !== kind) out.push(kind === 'table' ? '(table)' : '(code block)')
  })
  return out.join('\n')
}

// Turns a markdown reply into plain text that sounds natural when spoken.
export function toSpeech(markdown: string, maxChars = 4000): string {
  const fenced = markdown.replace(/(```|~~~)[\s\S]*?(?:\1|$)/g, '\n(code block)\n') // even when unclosed
  let text = dropTablesAndCommands(fenced)
    .replace(/\|/g, ', ')                                           // stray pipes
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')                      // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')                       // links -> link text
    .replace(/https?:\/\/\S+/g, 'link')                             // bare URLs
    .replace(/`([^`]+)`/g, '$1')                                    // inline code
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')                             // headings
    .replace(/^\s*>\s?/gm, '')                                      // blockquotes
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')                        // list markers
    .replace(/^\s*-{3,}\s*$/gm, '')                                 // horizontal rules
    .replace(/(\*\*|__)(.+?)\1/g, '$2')                             // bold
    .replace(/(^|\W)[*_](\S(?:.*?\S)?)[*_](?=\W|$)/g, '$1$2')       // italics
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')   // emoji
    .replace(/→/g, ' to ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/(\s*,\s*){2,}/g, ', ')
    .replace(/\n{2,}/g, '\n')
    .trim()

  if (text.length > maxChars) {
    text = text.slice(0, maxChars).replace(/\s\S*$/, '') + '. That is the end of the spoken part.'
  }
  return text
}

// Accepts 1.4, 1.4x or x1.4; undefined when it is not a speed.
export function parseSpeed(word: string): number | undefined {
  const match = /^x?(\d+(?:\.\d+)?)x?$/.exec(word)
  if (match === null) return undefined
  const n = Number(match[1])
  return n >= 0.5 && n <= 3 ? n : undefined
}

// One button press: moves the speed by `delta`, kept between 0.5 and 3.
export function stepSpeed(current: number, delta: number): number {
  return Math.min(3, Math.max(0.5, Math.round((current + delta) * 100) / 100))
}

// Splits speech into small pieces, so the first one comes back fast and
// plays while the next ones are still being made.
export function toChunks(text: string, firstMax = 200, max = 600): string[] {
  const sentences = text.split(/(?<=[.!?:])\s+|\n+/).map(t => t.trim()).filter(t => t !== '')
  const chunks: string[] = []
  let current = ''
  for (const sentence of sentences) {
    const limit = chunks.length === 0 ? firstMax : max
    if (current !== '' && current.length + 1 + sentence.length > limit) {
      chunks.push(current)
      current = sentence
    } else {
      current = current === '' ? sentence : `${current} ${sentence}`
    }
  }
  if (current !== '') chunks.push(current)
  return chunks
}
