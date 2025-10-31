import { describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import { InputSchema } from '../src/lib/schema.js'
import { createScreenshotHandler } from '../src/lib/handler.js'
import type { CaptureResult, Dependencies, WindowInfo } from '../src/lib/handler.js'

describe('InputSchema', () => {
  it('requires either bundleId or appName', () => {
    expect(() => InputSchema.parse({})).toThrowError()
  })

  it('applies defaults for optional fields', () => {
    const parsed = InputSchema.parse({ bundleId: 'com.example.app' })
    expect(parsed.windowIndex).toBe(0)
    expect(parsed.format).toBe('png')
    expect(parsed.includeShadow).toBe(false)
    expect(parsed.timeoutMs).toBe(30_000)
    expect(parsed.preferWindowId).toBe(false)
  })
})

describe('createScreenshotHandler', () => {
  const baseInput = { bundleId: 'com.example.app' } as const

  const windowInfo: WindowInfo = {
    appName: 'ExampleApp',
    rect: { x: 10, y: 20, w: 300, h: 200 },
    scale: 2,
  }

  const captureResult: CaptureResult = {
    path: '/tmp/example/shot.png',
    format: 'png',
    rect: windowInfo.rect,
    scale: windowInfo.scale,
    appName: windowInfo.appName,
  }

  const makeDeps = () => {
    const resolveWindow = vi.fn().mockResolvedValue(windowInfo)
    const capture = vi.fn().mockResolvedValue(captureResult)
    const scheduleCleanup = vi.fn()
    const getTtlMs = vi.fn().mockReturnValue(600_000)

    const deps: Dependencies = {
      resolveWindow,
      capture,
      scheduleCleanup,
      getTtlMs,
    }

    return { deps, resolveWindow, capture, scheduleCleanup, getTtlMs }
  }

  it('returns structured result with resource', async () => {
    const { deps, resolveWindow, capture, scheduleCleanup } = makeDeps()
    const handler = createScreenshotHandler(deps)

    const output = await handler(baseInput)

    expect(resolveWindow).toHaveBeenCalled()
    expect(capture).toHaveBeenCalled()
    expect(scheduleCleanup).toHaveBeenCalledWith('/tmp/example', 600_000)
    expect(output.isError).toBeFalsy()
    expect(output.structuredContent).toEqual({
      path: '/tmp/example/shot.png',
      uri: 'file:///tmp/example/shot.png',
      appName: 'ExampleApp',
      rect: windowInfo.rect,
      scale: windowInfo.scale,
      format: 'png',
    })
    const [jsonContent, resourceContent] = output.content
    expect(jsonContent).toMatchObject({ type: 'text' })
    expect(resourceContent).toMatchObject({
      type: 'resource_link',
      uri: 'file:///tmp/example/shot.png',
      mimeType: 'image/png',
      name: 'shot.png',
      title: 'ExampleApp',
    })
  })

  it('honors TTL override from dependencies', async () => {
    const { deps, scheduleCleanup, getTtlMs } = makeDeps()
    getTtlMs.mockReturnValue(10_000)
    const handler = createScreenshotHandler(deps)

    await handler(baseInput)

    expect(scheduleCleanup).toHaveBeenCalledWith('/tmp/example', 10_000)
  })

  it('propagates validation errors as MCP errors', async () => {
    const { deps } = makeDeps()
    const handler = createScreenshotHandler(deps)

    const result = await handler({})

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('bundleId')
  })

  it('returns MCP error when window resolution fails', async () => {
    const { deps, resolveWindow } = makeDeps()
    resolveWindow.mockRejectedValue(
      Object.assign(new Error('NoWindow'), {
        code: 'NoWindow',
        details: { appName: 'ExampleApp' },
      }),
    )
    const handler = createScreenshotHandler(deps)

    const result = await handler(baseInput)

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('NoWindow')
  })
})
