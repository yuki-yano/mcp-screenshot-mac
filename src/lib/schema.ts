import { z } from 'zod'

export const InputSchema = z
  .object({
    bundleId: z.string().trim().min(1).optional(),
    appName: z.string().trim().min(1).optional(),
    windowIndex: z.number().int().nonnegative().default(0),
    format: z.enum(['png', 'jpg']).default('png'),
    includeShadow: z.boolean().default(false),
    timeoutMs: z.number().int().min(1_000).default(30_000),
    preferWindowId: z.boolean().default(false),
  })
  .refine((value) => Boolean(value.bundleId) || Boolean(value.appName), {
    message: 'bundleId または appName のいずれかは必須です',
    path: ['bundleId'],
  })

export type ScreenshotInput = z.infer<typeof InputSchema>
