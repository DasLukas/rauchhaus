import { pageForSearch, type Page } from '../navigation'

export function bindLessonHint(lesson: HTMLButtonElement, module: Exclude<Page, 'dashboard'>) {
  const previousPage = document.referrer ? new URL(document.referrer) : null
  const fromApp = previousPage?.origin === location.origin &&
    new URL('.', previousPage).href === new URL('.', location.href).href
  const previousModule = fromApp ? pageForSearch(previousPage.search) : null
  const hintKey = module + '-lesson-hint'
  function updateLessonHint() {
    let highlight = previousModule === 'dashboard'
    try {
      const state = sessionStorage.getItem(hintKey)
      highlight = state !== 'started' && (highlight || (previousModule === module && state === 'pending'))
      if (highlight) sessionStorage.setItem(hintKey, 'pending')
    } catch { /* The hint also works for this visit when storage is unavailable. */ }
    lesson.classList.toggle('highlight-bulb', highlight)
  }
  updateLessonHint()
  window.addEventListener('pageshow', updateLessonHint)
  return {
    started() {
      lesson.classList.remove('highlight-bulb')
      try {
        sessionStorage.setItem(hintKey, 'started')
      } catch { /* The highlight has already stopped for this visit. */ }
    },
    dispose() { window.removeEventListener('pageshow', updateLessonHint) },
  }
}
