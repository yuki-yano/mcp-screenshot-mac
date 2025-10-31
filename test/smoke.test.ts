import { describe, expect, it } from 'vitest'
import { initialize } from '../src/index.js'

describe('initialize', () => {
  it('executes without throwing', () => {
    expect(() => initialize()).not.toThrow()
  })
})
