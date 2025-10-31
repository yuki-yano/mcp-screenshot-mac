import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import crypto from 'node:crypto'

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

import { execa } from 'execa'
import type { Result } from 'execa'
import { captureScreenshot } from '../src/lib/screencapture.js'
import type { ScreenshotInput } from '../src/lib/schema.js'
import type { WindowInfo } from '../src/lib/handler.js'

const baseInput: ScreenshotInput = {
  bundleId: 'com.example.app',
  appName: undefined,
  windowIndex: 0,
  format: 'png',
  includeShadow: false,
  timeoutMs: 10_000,
  preferWindowId: false,
}

const windowInfo: WindowInfo = {
  appName: 'Example',
  rect: { x: 10, y: 20, w: 300, h: 200 },
  scale: 2,
}

describe('captureScreenshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-0000-0000-000000000000')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('captures using rectangle mode when preferWindowId is false', async () => {
    vi.mocked(execa).mockResolvedValue({ stdout: '' } as Result)

    const result = await captureScreenshot(baseInput, windowInfo)

    expect(execa).toHaveBeenCalledWith(
      'screencapture',
      expect.arrayContaining(['-R', '10,20,300,200']),
      expect.objectContaining({ timeout: 10_000 }),
    )
    expect(result.path).toMatch(/mcp-screenshot-.*\/shot-00000000-0000-0000-0000-000000000000.png$/)
  })

  it('tries window id when preferWindowId is true', async () => {
    vi.mocked(execa)
      .mockResolvedValueOnce({ stdout: ' 42\n' } as Result)
      .mockResolvedValue({ stdout: '' } as Result)

    const result = await captureScreenshot({ ...baseInput, preferWindowId: true }, windowInfo)

    const callArgs = vi.mocked(execa).mock.calls
    expect(callArgs[0][0]).toBe('bash')
    expect(callArgs[0][1]).toEqual(['-lc', expect.stringContaining('GetWindowID')])
    expect(callArgs[1][0]).toBe('screencapture')
    expect(callArgs[1][1]).toContain('-l')
    expect(callArgs[1][1]).toContain('42')
    expect(result.path).toMatch(/shot-00000000-0000-0000-0000-000000000000.png$/)
  })
})
