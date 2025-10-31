import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTtlMs, scheduleCleanup } from '../src/lib/temp-files.js'

vi.mock('node:fs', () => ({
  promises: {
    rm: vi.fn().mockResolvedValue(undefined),
  },
}))

import { promises as fs } from 'node:fs'

describe('getTtlMs', () => {
  afterEach(() => {
    delete process.env.MCP_SCREENSHOT_MAC_TTL_MS
  })

  it('returns default when env is not set', () => {
    expect(getTtlMs()).toBe(600_000)
  })

  it('parses numeric env', () => {
    process.env.MCP_SCREENSHOT_MAC_TTL_MS = '1000'
    expect(getTtlMs()).toBe(1_000)
  })

  it('ignores invalid values', () => {
    process.env.MCP_SCREENSHOT_MAC_TTL_MS = 'invalid'
    expect(getTtlMs()).toBe(600_000)
  })
})

describe('scheduleCleanup', () => {
  it('schedules deletion after ttl', () => {
    vi.useFakeTimers()

    scheduleCleanup('/tmp/example', 1000)

    vi.advanceTimersByTime(1000)

    expect(fs.rm).toHaveBeenCalledWith('/tmp/example', { recursive: true, force: true })

    vi.useRealTimers()
  })
})
