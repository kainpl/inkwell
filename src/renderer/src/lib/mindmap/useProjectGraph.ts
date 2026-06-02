import { useEffect, useMemo, useState } from 'react'
import type { GraphModel } from '@shared/mindmap/types'
import { getProjectDoc } from './yjsRegistry'
import { yjsToOutline } from './yjsModel'
import { buildGraph } from './buildGraph'

/** Live graph for a project tab — rebuilt from the Y.Doc on every edit. */
export function useProjectGraph(tabId: string | null): GraphModel | null {
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const entry = tabId ? getProjectDoc(tabId) : undefined
    if (!entry) return
    const nodes = entry.doc.getMap('nodes')
    const bump = (): void => setVersion((v) => v + 1)
    nodes.observeDeep(bump)
    return () => nodes.unobserveDeep(bump)
  }, [tabId])

  return useMemo(() => {
    const entry = tabId ? getProjectDoc(tabId) : undefined
    return entry ? buildGraph(yjsToOutline(entry.doc)) : null
    // `version` is an intentional dep: it bumps on every doc mutation to force a rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, version])
}
