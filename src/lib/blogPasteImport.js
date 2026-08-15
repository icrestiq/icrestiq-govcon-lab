// Converts rich text pasted from Word/Google Docs/Notion/etc. into the
// plain-text-with-light-markdown format BlogPost.jsx's renderBody expects:
// blank-line-separated paragraphs, "## "/"### " headings, "- "/"1. " lists,
// "| cell | cell |" tables, and **bold**/*italic*/__underline__/[text](url)
// inline formatting. Goal is "paste and it looks the same on the post page,"
// not a general-purpose HTML-to-markdown converter.

function inlineMarkdown(node) {
  let result = ''
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      result += child.textContent
      continue
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue

    const tag = child.tagName.toLowerCase()
    const inner = inlineMarkdown(child)
    if (tag === 'strong' || tag === 'b') result += inner.trim() ? `**${inner}**` : inner
    else if (tag === 'u') result += inner.trim() ? `__${inner}__` : inner
    else if (tag === 'em' || tag === 'i') result += inner.trim() ? `*${inner}*` : inner
    else if (tag === 'a') result += `[${inner || child.getAttribute('href') || ''}](${child.getAttribute('href') || ''})`
    else if (tag === 'br') result += '\n'
    else result += inner
  }
  return result
}

function tableCellText(cell) {
  return inlineMarkdown(cell).trim().replace(/\|/g, '\\|').replace(/\s+/g, ' ')
}

function blockFromTable(table) {
  const rows = Array.from(table.querySelectorAll('tr'))
  if (!rows.length) return null
  const cellsOf = row => Array.from(row.children).map(tableCellText)
  const header = cellsOf(rows[0])
  const dataRows = rows.slice(1).map(cellsOf)
  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...dataRows.map(r => `| ${r.join(' | ')} |`),
  ]
  return lines.join('\n')
}

function blockFromList(list) {
  const ordered = list.tagName.toLowerCase() === 'ol'
  const items = Array.from(list.children).filter(c => c.tagName.toLowerCase() === 'li')
  const lines = items
    .map((li, i) => `${ordered ? `${i + 1}.` : '-'} ${inlineMarkdown(li).trim()}`)
    .filter(l => l.length > (ordered ? String(items.length).length + 2 : 2))
  return lines.length ? lines.join('\n') : null
}

function walkBlocks(container, blocks) {
  for (const child of container.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent.trim()
      if (text) blocks.push(text)
      continue
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue

    const tag = child.tagName.toLowerCase()
    if (/^h[1-6]$/.test(tag)) {
      const text = inlineMarkdown(child).trim()
      if (text) blocks.push(`${Number(tag[1]) <= 2 ? '##' : '###'} ${text}`)
    } else if (tag === 'p') {
      const text = inlineMarkdown(child).trim()
      if (text) blocks.push(text)
    } else if (tag === 'ul' || tag === 'ol') {
      const block = blockFromList(child)
      if (block) blocks.push(block)
    } else if (tag === 'table') {
      const block = blockFromTable(child)
      if (block) blocks.push(block)
    } else if (tag === 'br' || tag === 'style' || tag === 'script') {
      // skip
    } else {
      // div/span/section wrappers (common in Word/Docs exports) — recurse
      // to find the real block-level content inside.
      walkBlocks(child, blocks)
    }
  }
}

export function htmlToBodyText(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const blocks = []
  walkBlocks(doc.body, blocks)
  return blocks.filter(Boolean).join('\n\n')
}

export function plainTextToBodyText(text) {
  return text.replace(/\n{3,}/g, '\n\n').trim()
}
