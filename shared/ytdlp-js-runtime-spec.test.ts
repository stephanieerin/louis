import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseYtdlpJsRuntimeSpec } from './ytdlp-js-runtime-spec.mjs'

describe('parseYtdlpJsRuntimeSpec', () => {
  it('parses bare runtime', () => {
    assert.deepEqual(parseYtdlpJsRuntimeSpec('node'), { runtime: 'node', binaryPath: null })
  })

  it('parses unix absolute path', () => {
    assert.deepEqual(
      parseYtdlpJsRuntimeSpec('node:/Users/sdr/Library/Application Support/Louis/audio/bin/node'),
      {
        runtime: 'node',
        binaryPath: '/Users/sdr/Library/Application Support/Louis/audio/bin/node',
      },
    )
  })

  it('keeps Windows drive colon in the path', () => {
    assert.deepEqual(
      parseYtdlpJsRuntimeSpec('node:C:\\Users\\sdr\\AppData\\Roaming\\Louis\\audio\\bin\\node.cmd'),
      {
        runtime: 'node',
        binaryPath: 'C:\\Users\\sdr\\AppData\\Roaming\\Louis\\audio\\bin\\node.cmd',
      },
    )
  })
})
