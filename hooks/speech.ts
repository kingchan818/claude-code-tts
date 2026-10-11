// Turns a markdown reply into plain text that sounds natural when spoken.
export function toSpeech(markdown: string, maxChars = 4000): string {
  let text = markdown
    .replace(/```[\s\S]*?```/g, ' (code block) ')                // fenced code
    .replace(/^\s*\|?\s*:?-{3,}.*$/gm, '')                          // table separator rows
    .replace(/\|/g, ', ')                                           // table cells
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
