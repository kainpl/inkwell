const SHORTCUTS: [string, string][] = [
  ['Tab', 'Add child'],
  ['Enter', 'Add sibling'],
  ['F2 / double-click', 'Rename'],
  ['Delete / Backspace', 'Delete selection'],
  ['↑ ↓ ← →', 'Move selection'],
  ['1–9', 'Expand to that depth'],
  ['0', 'Expand all'],
  ['Home', 'Go to root'],
  ['Ctrl/⌘ + Shift + F', 'Search nodes'],
  ['Shift / ⌘ + click', 'Multi-select'],
  ['Click a tag', 'Highlight that tag'],
  ['. (or Focus button)', 'Focus the branch'],
  ['Esc', 'Clear highlight / focus'],
  ['Ctrl/⌘ + Z · Shift+Z', 'Undo · Redo'],
  ['Ctrl/⌘ + S', 'Save project'],
  ['?', 'This help']
]

/** Keyboard-shortcuts overlay for the schema canvas (toggled by `?`). */
export default function HotkeysHelp({ onClose }: { onClose: () => void }): JSX.Element {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-ink/30 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-full w-[360px] overflow-auto rounded-lg border border-line bg-paper p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[14px] font-medium text-ink">Keyboard shortcuts</h2>
          <button onClick={onClose} className="text-faint hover:text-ink" title="Close (Esc)">
            ✕
          </button>
        </div>
        <table className="w-full text-[12px]">
          <tbody>
            {SHORTCUTS.map(([keys, desc]) => (
              <tr key={keys} className="border-t border-line/60">
                <td className="py-1 pr-3 font-mono text-muted">{keys}</td>
                <td className="py-1 text-ink">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
