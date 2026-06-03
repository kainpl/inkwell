/**
 * Bridge for centering the canvas viewport on a node from outside the React Flow
 * context (e.g. the ProjectView key handler). `Canvas` registers a function (it has
 * both the layout and a React Flow instance); callers invoke `centerOnNode(id)`.
 */
let fn: ((id: string) => void) | null = null
export const setCenterNodeFn = (f: ((id: string) => void) | null): void => {
  fn = f
}
export const centerOnNode = (id: string): void => fn?.(id)
