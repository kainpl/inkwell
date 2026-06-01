/** Markdown-ish file extensions the app registers for / opens. */
const DOC_EXT = /\.(md|markdown|mdown|mkd|mdwn|mdtxt|mdtext|txt)$/i

/**
 * Find a document path among process arguments (skips the executable and flags).
 * Used to open a file the OS launched us with (Windows/Linux pass it in argv).
 * Pure, so it can be unit tested without electron.
 */
export function fileFromArgv(argv: readonly string[]): string | null {
  for (const arg of argv.slice(1)) {
    if (!arg || arg.startsWith('-')) continue
    if (DOC_EXT.test(arg)) return arg
  }
  return null
}
