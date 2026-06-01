import { keymap } from '@codemirror/view'
import { Prec, Compartment, type Extension } from '@codemirror/state'
import { COMMANDS } from '@renderer/lib/commands'

/**
 * Custom keyboard shortcuts: user-defined command→key bindings, applied as a
 * high-precedence CodeMirror keymap that fires the command via triggerMenu (the
 * same path as the command palette). Note: keys already claimed by a native menu
 * accelerator are intercepted by the OS first; custom bindings add new shortcuts.
 */

interface KeyEventLike {
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
  key: string
}

/**
 * Convert a key press into a CodeMirror key string (e.g. `Mod-Shift-k`), or null
 * for a modifier-only / Escape press. `Mod` = Ctrl or Cmd. Pure — unit tested.
 */
export function keyComboToCM(e: KeyEventLike): string | null {
  if (e.key === 'Escape' || ['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) return null
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Mod')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  parts.push(e.key.length === 1 ? e.key.toLowerCase() : e.key)
  return parts.join('-')
}

/** Compartment so the custom keymap can be reconfigured when bindings change. */
export const keybindingsCompartment = new Compartment()

/** Build a high-precedence keymap from command→key bindings. */
export function customKeymap(bindings: Record<string, string>): Extension {
  const byId = new Map(COMMANDS.map((c) => [c.id, c]))
  const binds = Object.entries(bindings)
    .map(([id, key]) => {
      const cmd = byId.get(id)
      if (!cmd || !key) return null
      return {
        key,
        preventDefault: true,
        run: (): boolean => {
          window.api.triggerMenu(cmd.channel, cmd.arg)
          return true
        }
      }
    })
    .filter((b): b is NonNullable<typeof b> => b !== null)
  return Prec.highest(keymap.of(binds))
}
