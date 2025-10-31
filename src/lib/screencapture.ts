import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { execa } from 'execa'
import type { ScreenshotInput } from './schema.js'
import type { CaptureResult, WindowInfo } from './handler.js'

const TMP_PREFIX = 'mcp-screenshot-'

export async function captureScreenshot(
  input: ScreenshotInput,
  windowInfo: WindowInfo,
): Promise<CaptureResult> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), TMP_PREFIX))
  const filename = `shot-${crypto.randomUUID()}.${input.format}`
  const filepath = path.join(dir, filename)

  const baseArgs = ['-x', '-t', input.format]
  if (!input.includeShadow) {
    baseArgs.push('-o')
  }

  let args = [...baseArgs, '-R', formatRectArgs(windowInfo.rect)]

  if (input.preferWindowId) {
    const windowId = await resolveWindowId(windowInfo.appName, input.timeoutMs)
    if (windowId) {
      args = [...baseArgs, '-l', windowId]
    }
  }

  await execa('screencapture', [...args, filepath], {
    timeout: input.timeoutMs,
  })

  return {
    path: filepath,
    format: input.format,
    rect: windowInfo.rect,
    scale: windowInfo.scale,
    appName: windowInfo.appName,
  }
}

function formatRectArgs(rect: WindowInfo['rect']): string {
  return `${rect.x},${rect.y},${rect.w},${rect.h}`
}

async function resolveWindowId(appName: string, timeoutMs: number): Promise<string | null> {
  const cmd = `command -v GetWindowID >/dev/null 2>&1 && GetWindowID ${escapeForShell(appName)} --list | awk -F 'id=' '/size=[1-9]/{print $3; exit 0}'`
  try {
    const { stdout } = await execa('bash', ['-lc', cmd], {
      timeout: timeoutMs,
    })
    const id = stdout.trim()
    return id.length > 0 ? id : null
  } catch {
    return null
  }
}

function escapeForShell(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}
