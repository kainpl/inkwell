declare module 'nspell' {
  interface NSpell {
    correct(word: string): boolean
    suggest(word: string): string[]
    add(word: string): NSpell
    remove(word: string): NSpell
  }
  /** Build a checker from hunspell affix + dictionary data. */
  function nspell(aff: string | Buffer, dic: string | Buffer): NSpell
  export default nspell
}
