import type { EditorView } from '@codemirror/view'
import { applyFormat, type FormatAction } from './formatCommands'
import { applyTable, type TableAction } from './tableCommands'
import { uploadCurrentImage } from './uploadImage'
import { insertLocalImage } from './imageInsert'

/**
 * Run a toolbar / Format-menu action against the editor. Centralizes the async
 * actions (image file-picker, hosting upload) and the table sub-commands so the
 * menu wiring and the toolbars share one dispatch path; everything else is a
 * synchronous text transform handled by `applyFormat`.
 */
export function runFormatAction(view: EditorView, action: string): void {
  if (action === 'image') void insertLocalImage(view)
  else if (action === 'uploadImage') void uploadCurrentImage(view)
  else if (action.startsWith('table:')) applyTable(view, action.slice(6) as TableAction)
  else applyFormat(view, action as FormatAction)
}
