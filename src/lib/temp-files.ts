import { promises as fs } from 'node:fs'

const DEFAULT_TTL_MS = 600_000

export function getTtlMs(): number {
  const value = process.env.MCP_SCREENSHOT_MAC_TTL_MS
  if (value === undefined) {
    return DEFAULT_TTL_MS
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_TTL_MS
  }
  return parsed
}

export function scheduleCleanup(dir: string, ttlMs: number): void {
  const timer = setTimeout(() => {
    void fs.rm(dir, { recursive: true, force: true }).catch(() => {
      // ベストエフォートで削除する。失敗は無視する。
    })
  }, ttlMs)
  timer.unref?.()
}
