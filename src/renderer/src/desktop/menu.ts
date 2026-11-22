import type { RecentKind } from '@renderer/lib/recents'
import type { Command } from '@renderer/lib/shortcuts'

export const systemItems = {
  Cut: 'Cut',
  Copy: 'Copy',
  Paste: 'Paste',
  'Select all': 'SelectAll',
  Minimize: 'Minimize',
  Maximize: 'Maximize'
} as const
export type MenuAction = Command | keyof typeof systemItems
export type MenuEntry = MenuAction | RecentKind | '-'

export const menuGroups = {
  File: [
    'New',
    'Open File…',
    'Open Folder…',
    'files',
    'folders',
    '-',
    'Save',
    'Save As…',
    '-',
    'Settings',
    'Close'
  ],
  Edit: [
    'Undo',
    'Redo',
    '-',
    'Cut',
    'Copy',
    'Paste',
    'Select all',
    '-',
    'Find',
    '-',
    'Bold',
    'Italic',
    'Strikethrough',
    'Inline code',
    'Link'
  ],
  View: [
    'Sidebar',
    'Outline',
    'Source',
    'Focus',
    'Typewriter',
    '-',
    'Reload',
    'Actual Size',
    'Zoom In',
    'Zoom Out',
    'Full Screen'
  ],
  Window: ['Minimize', 'Maximize']
} as const satisfies Record<string, readonly MenuEntry[]>

export interface DesktopActions {
  customFrame: boolean
  run: (id: MenuAction) => Promise<void>
  closeWindow: () => Promise<void>
  recent: (kind: RecentKind, path: string) => Promise<void>
}
