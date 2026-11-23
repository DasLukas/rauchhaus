import { HOUSE_VARIANT, type HouseVariant } from '../simulation'
import { icon, type IconName } from './icons'

function control(id: string, glyph: IconName, label: string, compact = false) {
  return `<button id="${id}" type="button" class="pill${compact ? ' compact' : ''}" aria-label="${label}" title="${label}">${icon(glyph)}${compact ? '' : `<span>${label}</span>`}</button>`
}

/** Keep the current house selected and the alternative directly addressable. */
function houseChoice(variant: HouseVariant, label: string) {
  const glyph = icon(variant === 'klein' ? 'house' : 'apartments')
  const attrs = `class="pill compact" aria-label="${label}" title="${label}"`
  if (variant === HOUSE_VARIANT) return `<span ${attrs} role="img" aria-current="page">${glyph}</span>`
  return `<a id="switch-house" ${attrs} href="?modul=brandhaus&amp;haus=${variant}">${glyph}</a>`
}

/** Builds the single-screen workspace and its native, keyboard-accessible controls. */
export function mountLayout(host: HTMLElement) {
  host.innerHTML = `
    <header class="topbar">
      <div class="house-identity">
        <a class="pill compact" href="./" aria-label="Zur Übersicht" title="Zur Übersicht">${icon('overview')}</a>
        <h1 class="brand"><img src="${import.meta.env.BASE_URL}haus.svg" alt="" /><span>Brandhaus</span></h1>
      </div>
      <nav class="house-picker" aria-label="Haus auswählen">${houseChoice('klein', 'Kleines Haus')}${houseChoice('gross', 'Großes Haus')}</nav>
      <nav class="learning-tools" aria-label="Lernen und Hilfe">${control('lesson', 'bulb', 'Lernimpuls')}${control('help', 'help', 'Hilfe', true)}</nav>
    </header>
    <section class="stage" aria-label="Das Haus erkunden">
      <div id="viewport"></div>
      <div id="markers" aria-label="Versuche, Türen und Rauchmelder"></div>
      <div id="load-state" role="status"><span class="spinner"></span><span>Das Haus lädt …</span></div>
      <div id="trial" class="trial-bar" role="region" aria-label="Lernimpuls" hidden>
        <div class="trial-copy"><strong id="trial-name"></strong><span id="trial-hint"></span></div>
        <button id="trial-next" class="action" type="button"><span id="trial-action"></span>${icon('next')}</button>
        <button id="trial-end" class="compact close" type="button" aria-label="Lernimpuls beenden">${icon('close')}</button>
      </div>
    </section>
    <footer class="toolbar" aria-label="Versuch und Ansicht">
      <div class="play-controls">${control('pause', 'pause', 'Pause')}${control('restart', 'reset', 'Neu starten')}${control('sound', 'muted', 'Alarmton', true)}</div>
      <div class="view-controls">${control('out', 'minus', 'Verkleinern', true)}${control('in', 'plus', 'Vergrößern', true)}${control('home', 'house', 'Ganzes Haus zeigen', true)}${control('fullscreen', 'expand', 'Vollbild starten', true)}</div>
      <div id="fullscreen-message" role="status"></div>
    </footer>
    <div id="announcer" role="status" aria-live="polite" class="sr-only"></div>
    <dialog id="sheet" aria-labelledby="sheet-title"><div id="sheet-body"></div></dialog>`
}

export function setButton(button: HTMLButtonElement, glyph: IconName, label: string) {
  button.innerHTML = `${icon(glyph)}<span>${label}</span>`
  button.setAttribute('aria-label', label)
  button.title = label
}
