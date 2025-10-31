import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

import { execa } from 'execa'
import type { Result } from 'execa'
import { resolveWindow } from '../src/lib/jxa.js'
import type { ScreenshotInput } from '../src/lib/schema.js'

describe('resolveWindow', () => {
  const input: ScreenshotInput = {
    bundleId: 'com.example.app',
    appName: undefined,
    windowIndex: 0,
    format: 'png',
    includeShadow: false,
    timeoutMs: 5_000,
    preferWindowId: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses JXA output into window info', async () => {
    vi.mocked(execa).mockResolvedValue({
      stdout: JSON.stringify({
        appName: 'Example',
        rect: { x: 1, y: 2, w: 300, h: 200 },
        scale: 2,
      }),
    } as Result)

    const info = await resolveWindow(input)

    expect(execa).toHaveBeenCalled()
    expect(info).toEqual({
      appName: 'Example',
      rect: { x: 1, y: 2, w: 300, h: 200 },
      scale: 2,
    })
  })

  it('throws typed error when JXA reports failure', async () => {
    vi.mocked(execa).mockResolvedValue({
      stdout: JSON.stringify({ error: 'NoWindow', appName: 'Example' }),
    } as Result)

    await expect(resolveWindow(input)).rejects.toMatchObject({ code: 'NoWindow' })
  })
})
