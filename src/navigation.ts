export type Page = 'dashboard' | 'brandhaus' | 'verbrennungsdreieck'

/** Resolve a module deep link, including house bookmarks from the single-lesson site. */
export function pageForSearch(search: string): Page {
  const params = new URLSearchParams(search)
  const module = params.get('modul')
  if (module === 'brandhaus' || module === 'verbrennungsdreieck') return module
  if (module === null && (params.has('haus') || params.has('feuer'))) return 'brandhaus'
  return 'dashboard'
}
