/** Return a required interface element, or report the missing id during initialization. */
export function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id)
  if (!node) throw new Error(`Missing interface element: ${id}`)
  return node as T
}
