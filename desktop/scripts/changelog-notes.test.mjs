import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { changelogSection } from './changelog-notes.mjs'

const sample = `# Changelog

## [Unreleased]

## [1.2.3] - 2026-09-05

### Changed
- Bot checks retry player clients.

### Fixed
- Toast copy.

## [1.2.2] - 2026-09-02

### Fixed
- Splash shadow.

[Unreleased]: https://example.com/compare/v1.2.3...main
[1.2.3]: https://example.com/compare/v1.2.2...v1.2.3
`

describe('changelogSection', () => {
  it('reads a dated version section and stops at the next heading', () => {
    const body = changelogSection(sample, 'v1.2.3')
    assert.match(body, /Bot checks retry/)
    assert.match(body, /Toast copy/)
    assert.doesNotMatch(body, /Splash shadow/)
    assert.doesNotMatch(body, /1\.2\.3\]:/)
  })

  it('accepts a bare version and Unreleased', () => {
    assert.equal(changelogSection(sample, '1.2.2').includes('Splash shadow'), true)
    assert.equal(changelogSection(sample, 'Unreleased'), '')
  })

  it('returns empty when the heading is missing', () => {
    assert.equal(changelogSection(sample, '9.9.9'), '')
  })
})
