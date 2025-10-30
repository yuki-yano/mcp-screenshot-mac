import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createScreenshotHandler } from './lib/handler.js'
import { captureScreenshot } from './lib/screencapture.js'
import { getTtlMs, scheduleCleanup } from './lib/temp-files.js'
import { resolveWindow } from './lib/jxa.js'
import { InputSchema } from './lib/schema.js'

const VERSION = process.env.npm_package_version ?? '0.1.0'

const ToolInputJsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: false,
  anyOf: [{ required: ['bundleId'] }, { required: ['appName'] }],
  properties: {
    bundleId: { type: 'string', description: '例: com.apple.Safari' },
    appName: { type: 'string', description: '例: Safari（bundleId が不明な場合）' },
    windowIndex: { type: 'integer', minimum: 0, default: 0 },
    format: { type: 'string', enum: ['png', 'jpg'], default: 'png' },
    includeShadow: { type: 'boolean', default: false },
    timeoutMs: { type: 'integer', minimum: 1000, default: 30000 },
    preferWindowId: { type: 'boolean', default: false },
  },
} as const

export function createServer() {
  const server = new McpServer({ name: 'mcp-screenshot-mac', version: VERSION })
  const handler = createScreenshotHandler({
    resolveWindow,
    capture: captureScreenshot,
    scheduleCleanup,
    getTtlMs,
  })

  const registerTool = (name: string, configureMetadata: boolean) => {
    const tool = server.tool(
      name,
      InputSchema.shape as unknown as Record<string, unknown>,
      async (args: unknown) => handler(args),
    )

    if (configureMetadata) {
      tool.update({
        title: 'Screenshot macOS app window',
        description: 'macOSアプリの前面ウィンドウをスクリーンショットしてパスとURIを返す',
        annotations: {
          schema: ToolInputJsonSchema,
        },
      })
    }
  }

  registerTool('screenshot_app_window', true)
  ;['mcp__screenshot__screenshot_app_window', 'screenshot__screenshot_app_window'].forEach(
    (alias) => registerTool(alias, false),
  )

  return server
}

export async function startServer() {
  const server = createServer()
  await server.connect(new StdioServerTransport())
  return server
}
