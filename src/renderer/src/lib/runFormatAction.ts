import type { EditorView } from '@codemirror/view'
import { addCursorAbove, addCursorBelow } from '@codemirror/commands'
import { selectNextOccurrence } from '@codemirror/search'
import { applyFormat, type FormatAction } from './formatCommands'
import { applyTable, type TableAction } from './tableCommands'
import { uploadCurrentImage } from './uploadImage'
import { insertLocalImage } from './imageInsert'

/** Multi-cursor commands (also bound to keys in markdownExtensions). */
const CURSOR_COMMANDS: Record<string, (view: EditorView) => boolean> = {
  cursorAbove: addCursorAbove,
  cursorBelow: addCursorBelow,
  selectNextOccurrence
}

/**
 * Run a toolbar / Format-menu / command-palette action against the editor.
 * Centralizes the async actions (image file-picker, hosting upload), the table
 * sub-commands and the multi-cursor commands so the menu, toolbars and palette
 * share one dispatch path; everything else is a synchronous text transform.
 */
export function runFormatAction(view: EditorView, action: string): void {
  if (action === 'image') void insertLocalImage(view)
  else if (action === 'uploadImage') void uploadCurrentImage(view)
  else if (action.startsWith('table:')) applyTable(view, action.slice(6) as TableAction)
  else if (CURSOR_COMMANDS[action]) {
    CURSOR_COMMANDS[action](view)
    view.focus()
  } else applyFormat(view, action as FormatAction)
}
