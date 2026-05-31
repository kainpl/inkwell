import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import StartupError from './components/StartupError'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/700.css'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)

// The renderer reaches the OS only through the preload's `window.api` bridge.
// If the preload failed to load, every file/menu action throws and React
// unmounts into a silent white screen. Detect it and explain instead.
if (typeof window.api === 'undefined') {
  root.render(
    <React.StrictMode>
      <StartupError
        title="Inkwell failed to start"
        detail={
          'The preload bridge (window.api) did not load, so file and menu ' +
          'actions are unavailable.\n\nThis usually means the preload path is ' +
          'wrong or the preload failed to build. Check the main-process console ' +
          'for a preload error and confirm out/preload/index.mjs exists.'
        }
      />
    </React.StrictMode>
  )
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
