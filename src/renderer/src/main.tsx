import React from 'react'
import ReactDOM from 'react-dom/client'
import { isTauri } from '@tauri-apps/api/core'
import { files } from './desktop/files'
import { installDesktopShell } from './desktop/shell'
import App from './App'
import StartupError from './components/StartupError'
import 'katex/dist/katex.min.css'
import '@fontsource-variable/jetbrains-mono'
import { translate } from './lib/i18n'
import './index.css'
import './palettes.css'
import './preferences.css'
import './components/Editor/widgets.css'

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)

async function start(): Promise<void> {
  if (!isTauri())
    throw new Error(translate('Open Inkwell in its desktop window. For development, run npm run dev.'))
  window.api = files
  await installDesktopShell()
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

void start().catch((error: unknown) => {
  root.render(<StartupError title={translate('Inkwell failed to start')} detail={String(error)} />)
})
