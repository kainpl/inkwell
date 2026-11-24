import { useEffect, type CSSProperties } from 'react'
import { useAppStore } from '@renderer/store/useAppStore'
import TitleBar from '@renderer/components/TitleBar'
import Sidebar from '@renderer/components/Sidebar'
import StatusBar from '@renderer/components/StatusBar'
import Editor from '@renderer/components/Editor/Editor'
import ConfirmUnsavedModal from '@renderer/components/ConfirmUnsavedModal'
import ExternalChangeNotice from '@renderer/components/ExternalChangeNotice'
import DocumentTabs from '@renderer/components/DocumentTabs'

import Preferences from './components/Preferences'
import { useShallow } from 'zustand/react/shallow'
import { fonts } from './lib/settings'
import type { DesktopActions } from './desktop/menu'

export default function App({ actions }: { actions: DesktopActions }): JSX.Element {
  const theme = useAppStore((s) => s.theme)
  const tab = useAppStore((s) => s.documentId)

  const [palette, font, fontSize, lineHeight, columnWidth, preferencesOpen, language] = useAppStore(
    useShallow(
      (s) =>
        [
          s.palette,
          s.font,
          s.fontSize,
          s.lineHeight,
          s.columnWidth,
          s.preferencesOpen,
          s.language
        ] as const
    )
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.dataset.theme = palette.toLowerCase()
    document.documentElement.lang = language
  }, [theme, palette, language])

  return (
    <div className="flex h-full w-full flex-col bg-paper">
      <TitleBar actions={actions} />
      <ExternalChangeNotice />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main
          className="flex min-w-0 flex-1 flex-col"
          style={
            {
              '--document-font': fonts[font],
              '--document-size': fontSize + 'px',
              '--line-height': lineHeight,
              '--column-width': columnWidth + '%',
              '--code-font': font === 'JetBrains Mono' ? fonts[font] : fonts.Monospace
            } as CSSProperties
          }
        >
          <DocumentTabs />
          <div
            id="document-editor"
            role="tabpanel"
            aria-labelledby={'document-tab-' + tab}
            className="min-h-0 flex-1"
          >
            <Editor />
          </div>
        </main>
      </div>
      <StatusBar />
      {preferencesOpen && <Preferences />}
      <ConfirmUnsavedModal />
    </div>
  )
}
