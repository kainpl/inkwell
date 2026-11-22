import { useEffect, useRef } from 'react'
import { Compartment, EditorState, type StateEffect } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { inkwellExtensions, modeCompartment, modeExtensions } from './markdownExtensions'
import { previewContext } from './livePreview'
import { useAppStore } from '@renderer/store/useAppStore'
import { revealInEditor } from '@renderer/lib/outline'

import { ukrainian } from '@renderer/lib/i18n'
import { spellingExtension } from './spelling'
import { smartPunctuation } from './smartPunctuation'
import { typewriterPlugin } from './typewriter'

export const GOTO_EVENT = 'ink:goto'

const typing = new Compartment()
const spelling = new Compartment()
const locale = new Compartment()
const context = new Compartment()

function currentContext() {
  const { doc, theme, features } = useAppStore.getState()
  return previewContext.of({ docPath: doc.path, dark: theme === 'dark', features })
}

function typingExtensions() {
  const s = useAppStore.getState()
  return [
    s.smartPunctuation && !s.sourceMode ? smartPunctuation() : [],
    s.typewriterMode
      ? [typewriterPlugin, EditorView.editorAttributes.of({ class: 'ink-typewriter' })]
      : []
  ]
}
function localeExtensions() {
  return EditorState.phrases.of(useAppStore.getState().language === 'uk' ? ukrainian : {})
}

function documentState(): EditorState {
  const { doc, setContent, sourceMode, spellCheck, documentEol } = useAppStore.getState()
  return EditorState.create({
    doc: doc.content,
    extensions: [
      context.of(currentContext()),
      locale.of(localeExtensions()),
      spelling.of(spellCheck ? spellingExtension() : []),
      typing.of(typingExtensions()),
      EditorView.contentAttributes.of({ spellcheck: 'false' }),
      inkwellExtensions(sourceMode),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) setContent(update.state.doc.sliceString(0, undefined, documentEol))
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
    const unsubscribe = useAppStore.subscribe((state, previous) => {
      if (state.documentId !== previous.documentId) {
        view.setState(documentState())
        view.scrollDOM.scrollTop = 0
        view.focus()
        return
      }
      const effects: StateEffect<unknown>[] = []
      if (state.sourceMode !== previous.sourceMode)
        effects.push(modeCompartment.reconfigure(modeExtensions(state.sourceMode)))
      if (
        state.sourceMode !== previous.sourceMode ||
        state.smartPunctuation !== previous.smartPunctuation ||
        state.typewriterMode !== previous.typewriterMode
      )
        effects.push(typing.reconfigure(typingExtensions()))
      if (
        state.spellCheck !== previous.spellCheck ||
        state.spellLanguages !== previous.spellLanguages ||
        state.personalWords !== previous.personalWords
      )
        effects.push(spelling.reconfigure(state.spellCheck ? spellingExtension() : []))
      if (
        state.theme !== previous.theme ||
        state.doc.path !== previous.doc.path ||
        state.features !== previous.features
      )
        effects.push(context.reconfigure(currentContext()))
      if (state.language !== previous.language) effects.push(locale.reconfigure(localeExtensions()))
      if (effects.length) view.dispatch({ effects })
      if (state.language !== previous.language) {
        const scroll = view.scrollDOM.scrollTop
        view.setState(view.state)
        view.scrollDOM.scrollTop = scroll
      }
      if (state.sourceMode !== previous.sourceMode && !state.preferencesOpen) view.focus()
    })

    const goto = (event: Event): void => revealInEditor(view, (event as CustomEvent<number>).detail)
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
