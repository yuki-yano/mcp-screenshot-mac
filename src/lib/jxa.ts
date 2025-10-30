import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execa, type ExecaError } from 'execa'
import type { ScreenshotInput } from './schema.js'
import type { WindowInfo } from './handler.js'

class WindowResolutionError extends Error {
  code: string
  details?: { appName: string }

  constructor(code: string, message: string, details?: { appName: string }) {
    super(message)
    this.code = code
    this.details = details
  }
}

const JXA_SOURCE = `
function run(argv) {
  ObjC.import('AppKit');
  const arg = JSON.parse(argv[0]);
  const targetApp = arg.bundleId ? Application(arg.bundleId) : Application(arg.appName);
  const appName = targetApp.name();
  targetApp.activate();
  delay(0.25);

  const systemEvents = Application('System Events');
  const process = systemEvents.processes.byName(appName);
  if (!process.exists()) {
    return JSON.stringify({ error: 'ProcessNotFound', appName });
  }

  const timeoutMs = arg.timeoutMs || 30000;
  const deadline = Date.now() + timeoutMs;
  var windows = process.windows();
  while (windows.length === 0 && Date.now() < deadline) {
    delay(0.1);
    windows = process.windows();
  }
  if (windows.length === 0) {
    return JSON.stringify({ error: 'NoWindow', appName });
  }

  const index = Math.min(arg.windowIndex || 0, windows.length - 1);
  const window = windows[index];
  const position = window.position();
  const size = window.size();

  var scale = 1;
  const center = {
    x: position[0] + size[0] / 2,
    y: position[1] + size[1] / 2,
  };

  if ($.NSScreen.screens) {
    const screens = ObjC.unwrap($.NSScreen.screens);
    for (var i = 0; i < screens.length; i++) {
      const screen = screens[i];
      const frame = screen.frame;
      const minX = frame.origin.x;
      const maxX = minX + frame.size.width;
      const minY = frame.origin.y;
      const maxY = minY + frame.size.height;
      if (center.x >= minX && center.x <= maxX && center.y >= minY && center.y <= maxY) {
        scale = screen.backingScaleFactor;
        break;
      }
    }
  }

  if (scale === 1 && $.NSScreen.mainScreen) {
    scale = $.NSScreen.mainScreen.backingScaleFactor;
  }

  const rect = {
    x: Math.round(position[0] * scale),
    y: Math.round(position[1] * scale),
    w: Math.round(size[0] * scale),
    h: Math.round(size[1] * scale),
  };

  return JSON.stringify({ appName, rect, scale: Number(scale) });
}
`

let scriptPathPromise: Promise<string> | null = null

export async function resolveWindow(input: ScreenshotInput): Promise<WindowInfo> {
  try {
    const { stdout } = await execa(
      'osascript',
      [
        '-l',
        'JavaScript',
        await getScriptPath(),
        JSON.stringify({
          bundleId: input.bundleId ?? null,
          appName: input.appName ?? null,
          windowIndex: input.windowIndex ?? 0,
        }),
      ],
      {
        timeout: input.timeoutMs,
      },
    )

    const parsed = parseJxaOutput(stdout)
    if ('error' in parsed) {
      throw new WindowResolutionError(
        parsed.error,
        parsed.error,
        parsed.appName ? { appName: parsed.appName } : undefined,
      )
    }

    return parsed
  } catch (error) {
    throw normalizeResolveWindowError(error, input)
  }
}

async function getScriptPath(): Promise<string> {
  if (!scriptPathPromise) {
    scriptPathPromise = (async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-screenshot-script-'))
      const file = path.join(dir, 'window-rect.jxa.js')
      await fs.writeFile(file, JXA_SOURCE, 'utf8')
      return file
    })()
  }

  return scriptPathPromise
}

type JxaSuccess = WindowInfo

type JxaError = {
  error: string
  appName?: string
}

type JxaOutput = JxaSuccess | JxaError

function parseJxaOutput(stdout: string): JxaOutput {
  try {
    const parsed = JSON.parse(stdout) as JxaOutput
    if ('error' in parsed) {
      return parsed
    }
    return {
      appName: parsed.appName,
      rect: {
        x: Number(parsed.rect.x),
        y: Number(parsed.rect.y),
        w: Number(parsed.rect.w),
        h: Number(parsed.rect.h),
      },
      scale: Number(parsed.scale),
    }
  } catch (error) {
    const parseError = new Error('JXA output parsing failed')
    ;(parseError as { cause: unknown }).cause = error
    throw parseError
  }
}

function normalizeResolveWindowError(error: unknown, input: ScreenshotInput): Error {
  if (isExecaError(error)) {
    const stderr = extractText(error.stderr)
    const stdout = extractText(error.stdout)
    const combined = `${stderr}\n${stdout}`.trim()
    if (
      combined.includes('osascriptには補助アクセスは許可されません') ||
      combined.includes('osascript is not allowed')
    ) {
      return new WindowResolutionError(
        'AccessibilityPermissionDenied',
        'macOSのアクセシビリティ権限が不足しています。システム設定 → プライバシーとセキュリティ → アクセシビリティ で「osascript」とこのMCPサーバを実行しているターミナル（例: Alacritty）への許可を付与してください。',
        input.appName ? { appName: input.appName } : undefined,
      )
    }
    const message = combined || error.shortMessage || error.message
    return new WindowResolutionError(
      'JXAExecutionFailed',
      message,
      input.appName ? { appName: input.appName } : undefined,
    )
  }
  return error instanceof Error ? error : new Error(String(error))
}

function isExecaError(error: unknown): error is ExecaError {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'exitCode' in error &&
      'command' in error &&
      'shortMessage' in error,
  )
}

function extractText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
