import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ZodError } from 'zod'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { InputSchema, type ScreenshotInput } from './schema.js'

export type Rect = {
  x: number
  y: number
  w: number
  h: number
}

export type WindowInfo = {
  appName: string
  rect: Rect
  scale: number
}

export type CaptureResult = {
  path: string
  format: 'png' | 'jpg'
  rect: Rect
  scale: number
  appName: string
}

export type Dependencies = {
  resolveWindow: (input: ScreenshotInput) => Promise<WindowInfo>
  capture: (input: ScreenshotInput, windowInfo: WindowInfo) => Promise<CaptureResult>
  scheduleCleanup: (dir: string, ttlMs: number) => void
  getTtlMs: () => number
}

export type HandlerResponse = CallToolResult

const FORMAT_MIME: Record<'png' | 'jpg', string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
}

const DEFAULT_ERROR_MESSAGE = 'スクリーンショット取得に失敗しました'

export function createScreenshotHandler(deps: Dependencies) {
  return async function handle(raw: unknown): Promise<HandlerResponse> {
    let input: ScreenshotInput

    try {
      input = InputSchema.parse(raw)
    } catch (error) {
      return errorResponse(formatZodError(error))
    }

    try {
      const windowInfo = await deps.resolveWindow(input)
      const captureResult = await deps.capture(input, windowInfo)

      const ttlMs = deps.getTtlMs()
      if (ttlMs > 0) {
        deps.scheduleCleanup(path.dirname(captureResult.path), ttlMs)
      }

      const uri = pathToFileURL(captureResult.path).href
      const resourceName = path.basename(captureResult.path)

      const structured = {
        path: captureResult.path,
        uri,
        appName: captureResult.appName,
        rect: captureResult.rect,
        scale: captureResult.scale,
        format: captureResult.format,
      }

      return {
        content: [
          { type: 'text', text: JSON.stringify(structured, null, 2) },
          {
            type: 'resource_link',
            uri,
            name: resourceName,
            title: captureResult.appName,
            description: `Screenshot of ${captureResult.appName}`,
            mimeType: FORMAT_MIME[captureResult.format],
          },
        ] as CallToolResult['content'],
        structuredContent: structured,
      }
    } catch (error) {
      return errorResponse(formatRuntimeError(error))
    }
  }
}

function formatZodError(error: unknown): string {
  if (isZodError(error)) {
    return error.issues.map((issue) => issue.message).join('\n')
  }
  return DEFAULT_ERROR_MESSAGE
}

function formatRuntimeError(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>
    const code = typeof record.code === 'string' ? record.code : undefined
    const message = typeof record.message === 'string' ? record.message : DEFAULT_ERROR_MESSAGE
    if (code) {
      return `${code}: ${message}`
    }
    return message
  }
  return DEFAULT_ERROR_MESSAGE
}

function errorResponse(message: string): HandlerResponse {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
  }
}

function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError
}
