import type { InkwellApi } from './index'

declare global {
  interface Window {
    api: InkwellApi
  }
}

export {}
