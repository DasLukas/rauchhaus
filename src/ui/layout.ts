import { icon, type IconName } from './icons'

function control(id: string, glyph: IconName, label: string, compact = false) {
  return `<button id="${id}" type="button" class="pill${compact ? ' compact' : ''}" aria-label="${label}" title="${label}">${icon(glyph)}${compact ? '' : `<span>${label}</span>`}</button>`
}

/** Builds the single-screen workspace and its native, keyboard-accessible controls. */
export function mountLayout(host: HTMLElement) {
  host.innerHTML = `
    <header class="topbar">
      <h1 class="brand">${icon('brand')}<span>Das Rauchhaus</span></h1>
      <nav aria-label="Lernen und Hilfe">${control('lesson', 'bulb', 'Lernimpuls')}${control('help', 'help', 'Hilfe')}</nav>
    </header>
    <section class="stage" aria-label="Das Haus erkunden">
      <div id="viewport"></div>
      <div id="markers" aria-label="Rauchquellen und Türen"></div>
      <div id="load-state" role="status"><span class="spinner"></span><span>Das Haus wird aufgebaut …</span></div>
      <div id="trial" role="region" aria-label="Geführter Türvergleich" hidden>
        <div class="trial-copy"><strong id="trial-name"></strong><span>Beobachte den Flur rechts.</span></div>
        <button id="trial-next" class="action" type="button"><span id="trial-action"></span>${icon('next')}</button>
        <button id="trial-end" class="compact close" type="button" aria-label="Lernimpuls beenden">${icon('close')}</button>
      </div>
    </section>
    <footer class="toolbar" aria-label="Versuch und Ansicht">
      <div class="legend surface" aria-label="Legende">
        <span><i class="key source">${icon('smoke')}</i>Rauchquelle</span>
        <span><i class="key door">${icon('door')}</i>Tür</span>
      </div>
      <div class="play-controls">${control('pause', 'pause', 'Pause')}${control('restart', 'reset', 'Neu starten')}</div>
      <div class="view-controls">${control('out', 'minus', 'Verkleinern', true)}${control('in', 'plus', 'Vergrößern', true)}${control('home', 'house', 'Ganzes Haus zeigen', true)}</div>
    </footer>
    <div id="announcer" role="status" aria-live="polite" class="sr-only"></div>
    <dialog id="sheet" aria-labelledby="sheet-title"><div id="sheet-body"></div></dialog>`
}

export function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id)
  if (!node) throw new Error(`Missing interface element: ${id}`)
  return node as T
}

export function setButton(button: HTMLButtonElement, glyph: IconName, label: string) {
  button.innerHTML = `${icon(glyph)}<span>${label}</span>`
  button.setAttribute('aria-label', label)
  button.title = label
}
