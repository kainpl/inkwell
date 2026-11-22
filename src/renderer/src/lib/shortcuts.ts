const mac = navigator.platform.startsWith('Mac')

export const defaultShortcuts = {
  New: 'Mod+N',
  'Open File…': 'Mod+O',
  'Open Folder…': 'Mod+Shift+O',
  Save: 'Mod+S',
  'Save As…': 'Mod+Shift+S',
  Settings: 'Mod+Comma',
  Close: 'Mod+W',
  Undo: 'Mod+Z',
  Redo: mac ? 'Mod+Shift+Z' : 'Mod+Y',
  Find: 'Mod+F',
  Bold: 'Mod+B',
  Italic: 'Mod+I',
  Strikethrough: '',
  'Inline code': '',
  Link: 'Mod+K',
  Sidebar: 'Mod+Backslash',
  Outline: 'Mod+Slash',
  Focus: 'Mod+Shift+F',
  Source: 'Mod+Shift+M',
  Typewriter: '',
  Reload: 'Mod+R',
  'Actual Size': 'Mod+0',
  'Zoom In': 'Mod+Equal',
  'Zoom Out': 'Mod+Minus',
  'Full Screen': mac ? 'Ctrl+Mod+F' : 'F11'
}
export type Command = keyof typeof defaultShortcuts
export type Shortcuts = Record<Command, string>
export const commands = Object.keys(defaultShortcuts) as Command[]

/** Accept one portable accelerator or an empty string to disable it. */
export function parseShortcut(input: string): string | null {
  if (!input.trim()) return ''
  const parts = input.replace(/\s/g, '').toLowerCase().split('+')
  const last = parts.pop()!
  const mods = new Set(
    parts.map((k) => (k === 'cmd' || k === 'command' || (!mac && k === 'ctrl') ? 'mod' : k))
  )
  if ([...mods].some((k) => !['ctrl', 'mod', 'alt', 'shift'].includes(k))) return null
  const named = [
    'Comma',
    'Period',
    'Minus',
    'Equal',
    'Slash',
    'Backslash',
    'BracketLeft',
    'BracketRight'
  ]
  const aliases: Record<string, string> = {
    ',': 'Comma',
    '.': 'Period',
    '-': 'Minus',
    '=': 'Equal',
    '/': 'Slash',
    '\\': 'Backslash',
    '[': 'BracketLeft',
    ']': 'BracketRight'
  }
  const key = aliases[last] ?? named.find((k) => k.toLowerCase() === last) ?? last.toUpperCase()
  if (
    !/^(?:F[1-9]|F1[0-9]|F2[0-4])$/.test(key) &&
    (!(mods.has('mod') || mods.has('ctrl') || mods.has('alt')) ||
      (!/^[A-Z0-9]$/.test(key) && !named.includes(key)))
  )
    return null
  return [...['Ctrl', 'Mod', 'Alt', 'Shift'].filter((k) => mods.has(k.toLowerCase())), key].join(
    '+'
  )
}
export function shortcutLabel(value: string): string {
  return value.replace('Mod', mac ? 'Cmd' : 'Ctrl')
}

export function eventShortcut(event: KeyboardEvent): string {
  const key = event.code.replace(/^(Key|Digit)/, '')
  const modifiers = [
    mac && event.ctrlKey ? 'Ctrl' : '',
    (mac ? event.metaKey : event.ctrlKey) ? 'Mod' : '',
    event.altKey ? 'Alt' : '',
    event.shiftKey ? 'Shift' : ''
  ].filter(Boolean)
  if ((!mac && event.metaKey) || (!modifiers.length && !/^F\d+$/.test(key))) return ''
  return [...modifiers, key].join('+')
}
