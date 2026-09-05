/**
 * Keep a Changelog section body for a version heading (`## [1.2.3]` / `## [Unreleased]`).
 */
export function changelogSection(markdown, version) {
  const label = String(version || '').trim().replace(/^v/i, '')
  if (!label) return ''

  const headingRe = new RegExp(`^## \\[${escapeRegExp(label)}\\][^\\n]*$`, 'm')
  const match = headingRe.exec(markdown)
  if (!match) return ''

  const lineEnd = markdown.indexOf('\n', match.index)
  const start = lineEnd === -1 ? markdown.length : lineEnd + 1
  const rest = markdown.slice(start)
  const next = rest.search(/\n## \[/)
  const body = (next === -1 ? rest : rest.slice(0, next)).trim()
  return body
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
