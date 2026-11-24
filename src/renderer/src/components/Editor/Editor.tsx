import { useEffect, useRef } from 'react'
import { Compartment, EditorState, type StateEffect } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { inkwellExtensions, modeCompartment, modeExtensions } from './markdownExtensions'
import { previewContext } from './livePreview'
import { activeTab, useAppStore } from '@renderer/store/useAppStore'
import { revealInEditor } from '@renderer/lib/outline'
import { literalSearch } from '@renderer/lib/folderSearch'

import { ukrainian } from '@renderer/lib/i18n'
import { spellingExtension } from './spelling'
import { smartPunctuation } from './smartPunctuation'
import { typewriterPlugin } from './typewriter'
import { diskReload, refreshEditor } from './reload'

export const GOTO_EVENT = 'ink:goto'

const typing = new Compartment()
const spelling = new Compartment()
const locale = new Compartment()
const context = new Compartment()

function currentContext() {
  const state = useAppStore.getState()
  const { doc } = activeTab(state)
  const { theme, features } = state
  return previewContext.of({ docPath: doc.path, dark: theme === 'dark', features })
}

function typingExtensions() {
  const s = useAppStore.getState()
  return [
    s.smartPunctuation && s.editorMode !== 'source' ? smartPunctuation() : [],
    s.typewriterMode
      ? [typewriterPlugin, EditorView.editorAttributes.of({ class: 'ink-typewriter' })]
      : []
  ]
}
function localeExtensions() {
  return EditorState.phrases.of(useAppStore.getState().language === 'uk' ? ukrainian : {})
}

function documentState(): EditorState {
  const { editorMode, spellCheck, setContent } = useAppStore.getState()
  const { doc, id } = activeTab(useAppStore.getState())
  return EditorState.create({
    doc: doc.content,
    extensions: [
      context.of(currentContext()),
      locale.of(localeExtensions()),
      spelling.of(spellCheck ? spellingExtension() : []),
      typing.of(typingExtensions()),
      EditorView.contentAttributes.of({ spellcheck: 'false' }),
      inkwellExtensions(editorMode),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !update.transactions.some((tr) => tr.annotation(diskReload))) {
          const tab = useAppStore.getState().tabs.find((entry) => entry.id === id)
          if (tab) setContent(update.state.doc.sliceString(0, undefined, tab.documentEol), id)
        }
      })
    ]
  })
}

export default function Editor(): JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  const focusMode = useAppStore((s) => s.focusMode)

  useEffect(() => {
    if (!host.current) return
    const view = new EditorView({ parent: host.current, state: documentState() })
    view.focus()
    const cached = new Map<
      number,
      { state: EditorState; scroll: ReturnType<EditorView['scrollSnapshot']> }
    >()
    const unsubscribe = useAppStore.subscribe((state, previous) => {
      const tab = activeTab(state)
      const oldTab = activeTab(previous)
      const switching = state.documentId !== previous.documentId
      if (switching && state.tabs.some((entry) => entry.id === oldTab.id)) {
        cached.set(oldTab.id, { state: view.state, scroll: view.scrollSnapshot() })
      }
      if (state.tabs !== previous.tabs) {
        for (const id of cached.keys())
          if (!state.tabs.some((entry) => entry.id === id)) cached.delete(id)
      }
      const effects: StateEffect<unknown>[] = []
      if (switching || state.editorMode !== previous.editorMode)
        effects.push(modeCompartment.reconfigure(modeExtensions(state.editorMode)))
      if (
        switching ||
        state.editorMode !== previous.editorMode ||
        state.smartPunctuation !== previous.smartPunctuation ||
        state.typewriterMode !== previous.typewriterMode
      )
        effects.push(typing.reconfigure(typingExtensions()))
      if (
        switching ||
        state.spellCheck !== previous.spellCheck ||
        state.spellLanguages !== previous.spellLanguages ||
        state.personalWords !== previous.personalWords
      )
        effects.push(spelling.reconfigure(state.spellCheck ? spellingExtension() : []))
      if (
        switching ||
        state.theme !== previous.theme ||
        tab.doc.path !== oldTab.doc.path ||
        state.features !== previous.features
      )
        effects.push(context.reconfigure(currentContext()))
      if (switching || state.language !== previous.language)
        effects.push(locale.reconfigure(localeExtensions()))
      if (switching) {
        const saved = cached.get(tab.id)
        cached.delete(tab.id)
        view.setState(saved ? saved.state.update({ effects }).state : documentState())
        if (saved) {
          view.dispatch({ effects: saved.scroll })
          // The tab may have received a different disk version while a save was in flight.
          refreshEditor(view, tab.doc.content, saved.scroll)
        } else {
          view.scrollDOM.scrollTop = 0
          view.scrollDOM.scrollLeft = 0
        }
        if (!state.preferencesOpen) view.focus()
        return
      }
      if (tab.reloadVersion !== oldTab.reloadVersion) refreshEditor(view, tab.doc.content)
      if (effects.length) view.dispatch({ effects })
      if (state.language !== previous.language) {
        const scroll = view.scrollDOM.scrollTop
        view.setState(view.state)
        view.scrollDOM.scrollTop = scroll
      }
      if (state.editorMode !== previous.editorMode && !state.preferencesOpen) view.focus()
    })

    const goto = (event: Event): void => {
      const target = (
        event as CustomEvent<number | { line: number; column: number; query: string }>
      ).detail
      if (typeof target === 'number') {
        revealInEditor(view, target)
      } else {
        const line = view.state.doc.line(Math.min(target.line, view.state.doc.lines))
        const match = literalSearch(target.query).exec(line.text)
        const from = match ? line.from + match.index : Math.min(line.from + target.column, line.to)
        const to = from + (match?.[0].length ?? 0)
        view.dispatch({
          selection: { anchor: from, head: to },
          effects: EditorView.scrollIntoView(from, { y: 'center' })
        })
        view.focus()
      }
    }
    window.addEventListener(GOTO_EVENT, goto)
    return () => {
      unsubscribe()
      window.removeEventListener(GOTO_EVENT, goto)
      view.destroy()
    }
  }, [])

  return (
    <div ref={host} className={'h-full w-full overflow-hidden ' + (focusMode ? 'ink-focus' : '')} />
  )
}
