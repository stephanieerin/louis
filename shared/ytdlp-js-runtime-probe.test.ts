import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  electronAsNodeProbe,
  jsRuntimeExecOptions,
  jsRuntimeUsesShell,
} from './ytdlp-js-runtime-probe.mjs'

describe('jsRuntimeUsesShell', () => {
  it('is true for Windows cmd/bat shims', () => {
    assert.equal(jsRuntimeUsesShell('C:\\Users\\sdr\\AppData\\Roaming\\Louis\\audio\\bin\\node.cmd'), true)
    assert.equal(jsRuntimeUsesShell('/tmp/node.bat'), true)
    assert.equal(jsRuntimeUsesShell('C:\\Program Files\\Louis\\Louis.exe'), false)
    assert.equal(jsRuntimeUsesShell('/usr/local/bin/node'), false)
  })
})

describe('jsRuntimeExecOptions', () => {
  it('sets shell for .cmd and always passes ELECTRON_RUN_AS_NODE', () => {
    const cmd = jsRuntimeExecOptions('C:\\Louis\\audio\\bin\\node.cmd', { PATH: 'C:\\Windows' })
    assert.equal(cmd.shell, true)
    assert.equal(cmd.env.ELECTRON_RUN_AS_NODE, '1')
    assert.equal(cmd.env.PATH, 'C:\\Windows')
    assert.equal(cmd.timeout, 15_000)

    const exe = jsRuntimeExecOptions('C:\\Program Files\\Louis\\Louis.exe', {})
    assert.equal(exe.shell, undefined)
    assert.equal(exe.env.ELECTRON_RUN_AS_NODE, '1')
  })
})

describe('electronAsNodeProbe', () => {
  it('returns null when this process is not Electron-as-node', () => {
    assert.equal(
      electronAsNodeProbe('node', null, { env: {}, version: 'v22.0.0' }),
      null,
    )
  })

  it('reports process.version without spawning when already Electron-as-node', () => {
    assert.deepEqual(
      electronAsNodeProbe('node', null, {
        env: { ELECTRON_RUN_AS_NODE: '1' },
        version: 'v22.14.0',
        execPath: 'C:\\Program Files\\Louis\\Louis.exe',
      }),
      {
        available: true,
        path: 'C:\\Program Files\\Louis\\Louis.exe',
        version: 'v22.14.0',
      },
    )
  })

  it('uses the spec path when that file exists', () => {
    const shim = 'C:\\Users\\sdr\\AppData\\Roaming\\Louis\\audio\\bin\\node.cmd'
    assert.deepEqual(
      electronAsNodeProbe('node', shim, {
        env: { ELECTRON_RUN_AS_NODE: '1' },
        version: 'v22.14.0',
        pathExists: p => p === shim,
      }),
      { available: true, path: shim, version: 'v22.14.0' },
    )
  })

  it('fails when the spec path is missing', () => {
    const shim = 'C:\\missing\\node.cmd'
    assert.deepEqual(
      electronAsNodeProbe('node', shim, {
        env: { ELECTRON_RUN_AS_NODE: '1' },
        version: 'v22.14.0',
        pathExists: () => false,
      }),
      { available: false, error: `JS runtime not executable at ${shim}` },
    )
  })
})
