const richTextToken = /(\r?\n|\*\*|\*)/g

function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function renderRichText(input?: string | null) {
  const source = String(input ?? '')
  let output = ''
  let cursor = 0
  const stack: Array<'strong' | 'em'> = []

  richTextToken.lastIndex = 0

  for (let match = richTextToken.exec(source); match; match = richTextToken.exec(source)) {
    output += escapeHtml(source.slice(cursor, match.index))

    const token = match[0]
    if (token === '\n' || token === '\r\n') {
      output += '<br>'
    } else if (token === '**') {
      if (stack.at(-1) === 'strong') {
        output += '</strong>'
        stack.pop()
      } else {
        output += '<strong>'
        stack.push('strong')
      }
    } else if (token === '*') {
      if (stack.at(-1) === 'em') {
        output += '</em>'
        stack.pop()
      } else {
        output += '<em>'
        stack.push('em')
      }
    }

    cursor = match.index + token.length
  }

  output += escapeHtml(source.slice(cursor))

  while (stack.length) {
    output += stack.pop() === 'strong' ? '</strong>' : '</em>'
  }

  return output
}
