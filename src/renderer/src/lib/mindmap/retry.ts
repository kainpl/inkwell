/**
 * Run `fn`, retrying on rejection with exponential backoff (`baseMs * 2^i`). Used to
 * ride out transient save failures (antivirus / sync holding the file). Rethrows the
 * last error after `attempts` tries. `sleep` is injectable for tests.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseMs = 200,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))
): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (i < attempts - 1) await sleep(baseMs * 2 ** i)
    }
  }
  throw lastErr
}
