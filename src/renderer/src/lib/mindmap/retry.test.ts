import { describe, it, expect, vi } from 'vitest'
import { withRetry } from './retry'

const noSleep = (): Promise<void> => Promise.resolve()

describe('withRetry', () => {
  it('returns on first success without sleeping', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    expect(await withRetry(fn, 3, 1, noSleep)).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('succeeds after transient failures', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('busy'))
      .mockRejectedValueOnce(new Error('busy'))
      .mockResolvedValue('ok')
    expect(await withRetry(fn, 3, 1, noSleep)).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('rethrows the last error after exhausting attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('nope'))
    await expect(withRetry(fn, 3, 1, noSleep)).rejects.toThrow('nope')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('backs off exponentially between attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('x'))
    const delays: number[] = []
    await withRetry(fn, 4, 100, (ms) => {
      delays.push(ms)
      return Promise.resolve()
    }).catch(() => undefined)
    expect(delays).toEqual([100, 200, 400]) // 3 sleeps between 4 attempts
  })
})
