#!/usr/bin/env node
/**
 * Create the GitHub Release for a tag if it is missing, using CHANGELOG.md notes.
 * Used by CI so installer attach does not wait on local release-it.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { changelogSection } from './changelog-notes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const tag = (process.argv[2] || process.env.GITHUB_REF_NAME || '').trim()
if (!/^v\d/.test(tag)) {
  console.error('[ensure-github-release] pass a tag (vX.Y.Z) or set GITHUB_REF_NAME')
  process.exit(1)
}

const repo = process.env.GITHUB_REPOSITORY || ''
const repoArgs = repo ? ['--repo', repo] : []

function gh(args, options = {}) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  })
}

try {
  gh(['release', 'view', tag, ...repoArgs], { stdio: ['ignore', 'ignore', 'ignore'] })
  console.log(`[ensure-github-release] ${tag} already exists`)
  process.exit(0)
}
catch {
  // create below
}

const markdown = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')
const notes = changelogSection(markdown, tag) || `See CHANGELOG.md for ${tag}.`
gh(['release', 'create', tag, '--title', tag, '--notes', notes, ...repoArgs], { stdio: 'inherit' })
console.log(`[ensure-github-release] created ${tag}`)
