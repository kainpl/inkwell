/// <reference types="vite/client" />

import type { files } from './desktop/files'

declare global {
  interface Window {
    api: typeof files
  }
}
