import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ytdlpJsRuntimeSpecForDesktop } from './js-runtime.mjs'
import { formatDegradedHealthError, formatHealthTimeoutMessage } from './nitro-health.mjs'

describe('ytdlpJsRuntimeSpecForDesktop', () => {
  it('points Windows at Louis.exe and others at the shim', () => {
    assert.equal(
      ytdlpJsRuntimeSpecForDesktop('win32', 'C:\\Program Files\\Louis\\Louis.exe', 'C:\\Users\\a\\Louis\\audio\\bin\\node.cmd'),
      'node:C:\\Program Files\\Louis\\Louis.exe',
    )
    assert.equal(
      ytdlpJsRuntimeSpecForDesktop(
        'darwin',
        '/Applications/Louis.app/Contents/MacOS/Louis',
        '/Users/sdr/Library/Application Support/Louis/audio/bin/node',
      ),
      'node:/Users/sdr/Library/Application Support/Louis/audio/bin/node',
    )
  })
})

describe('formatDegradedHealthError', () => {
  it('includes failed check errors from the health JSON', () => {
    assert.equal(
      formatDegradedHealthError(503, {
        status: 'degraded',
        checks: {
          ytdlp: { available: true },
          ffmpeg: { available: true },
          ytdlpJsRuntime: {
            available: false,
            error: 'JS runtime not executable at C:\\Users\\a\\Louis\\audio\\bin\\node.cmd',
          },
          audioWorkDir: { writable: true },
        },
      }),
      'HTTP 503: ytdlpJsRuntime: JS runtime not executable at C:\\Users\\a\\Louis\\audio\\bin\\node.cmd',
    )
  })

  it('joins several failed checks', () => {
    assert.equal(
      formatDegradedHealthError(503, {
        checks: {
          ytdlp: { available: false, error: 'yt-dlp not found' },
          ffmpeg: { available: false, error: 'Not found on PATH' },
          ytdlpJsRuntime: { available: true },
          audioWorkDir: { writable: false, error: 'EACCES' },
        },
      }),
      'HTTP 503: ytdlp: yt-dlp not found; ffmpeg: Not found on PATH; audioWorkDir: EACCES',
    )
  })

  it('falls back to HTTP status when the body has no checks', () => {
    assert.equal(formatDegradedHealthError(503, null), 'HTTP 503')
    assert.equal(formatDegradedHealthError(502, { status: 'degraded' }), 'HTTP 502')
  })
})

describe('formatHealthTimeoutMessage', () => {
  it('keeps the existing timeout prefix', () => {
    assert.equal(
      formatHealthTimeoutMessage('http://127.0.0.1:4010/api/health', 'HTTP 503: ytdlpJsRuntime: unavailable'),
      'Nitro health check timed out (http://127.0.0.1:4010/api/health): HTTP 503: ytdlpJsRuntime: unavailable',
    )
  })
})
