import { HOUSE_VARIANT } from '../simulation'
import { icon } from './icons'
import { element } from './dom'
import type { Lesson } from './session'

const closeButton = `<button class="close compact" data-close type="button" aria-label="Schließen">${icon('close')}</button>`

const help = `
  <header class="sheet-heading"><h2 id="sheet-title">So geht’s</h2>${closeButton}</header>
  <ul class="help-list">
    <li><i class="key source">${icon('smoke')}</i><div><strong>Feuer und Rauch beobachten</strong><p>Tippe auf ein oranges Rauchzeichen. Dort entsteht ein kleines Feuer. Wohin zieht der Rauch?</p></div></li>
    <li><i class="key door">${icon('door')}</i><div><strong>Türen ausprobieren</strong><p>Tippe auf eine Tür oder ihr türkises Zeichen. Mit jedem Tipp öffnet oder schließt sie sich.</p></div></li>
    <li><i class="key neutral">${icon('house')}</i><div><strong>Genauer hinschauen</strong><p>Tippe auf ein Stockwerk, um näher heranzugehen. In der Nahansicht kannst du das Haus mit dem Finger verschieben. Das Hauszeichen zeigt wieder alle Etagen.</p></div></li>
    <li><i class="key neutral">${icon('alarm')}</i><div><strong>Rauchwarnmelder</strong><p>Erreicht Rauch einen weißen Deckenmelder, blinkt seine Leuchte rot. Über den Lautsprecher unten kannst du den gemeinsamen Alarmton einschalten.</p></div></li>
  </ul>
  <details><summary>Für Erwachsene</summary><p>Warmer Rauch sammelt sich unter der Decke und zieht durch offene Türen weiter. Geschlossene Türen bremsen ihn. Für den Unterricht nimmt die Rauchmenge nach einer kurzen Anlaufphase zügig zu. Die Quelle raucht während des Versuchs weiter. Die Abläufe erlauben keine Aussage über sichere Aufenthalts- oder Fluchtzeiten.</p>
  <p>Das Haus lässt sich mit der Tabulatortaste erkunden. Eingabe oder Leertaste betätigen markierte Tasten. In der Gesamtansicht drehen die Pfeiltasten das Haus. In der Nahansicht verschieben sie den Ausschnitt. Mit 1 bis 4 wählst du die Etagen vom Erdgeschoss bis zum Dach.${HOUSE_VARIANT === 'gross' ? ' Mit 0 wählst du den Keller.' : ''} Pos1 zeigt das ganze Haus.</p><p><a href="https://github.com/DasLukas/rauchhaus" target="_blank" rel="noopener">Projekt, Quellen und Lizenzen</a></p></details>
  <button type="button" class="action" data-close>Verstanden</button>`

const intro = `
  <header class="sheet-heading"><span class="lesson-icon">${icon('bulb')}</span>${closeButton}</header>
  <h2 id="sheet-title">Wie breitet sich Rauch im Haus aus?</h2>
  <p>Im ersten Stock brennt der Fernseher. Wohin zieht der Rauch, wenn die Wohnungstür offen ist?</p>
  <p>Schau ins Treppenhaus ${HOUSE_VARIANT === 'klein' ? 'rechts neben der Wohnung' : 'zwischen den Wohnungen'}. Danach probierst du denselben Versuch mit geschlossener Tür.</p>
  <button type="button" class="action" data-start="doors">Versuch starten ${icon('next')}</button>`

const result = `
  <header class="sheet-heading"><span class="lesson-icon">${icon('eye')}</span>${closeButton}</header>
  <h2 id="sheet-title">Was war anders?</h2>
  <p>Erzähl, was du im Treppenhaus bei offener und bei geschlossener Wohnungstür gesehen hast.</p>
  <button type="button" class="action" data-panel="smokeFindings">Ergebnis ansehen ${icon('next')}</button>`

const smokeFindings = `
  <header class="sheet-heading"><span class="lesson-icon">${icon('eye')}</span>${closeButton}</header>
  <h2 id="sheet-title">Eine geschlossene Tür bremst den Rauch.</h2>
  <div class="scene-comparison">
    <figure data-view="open"><figcaption>Tür offen</figcaption></figure>
    <figure data-view="closed"><figcaption>Tür geschlossen</figcaption></figure>
  </div>
  <p>Durch die offene Tür zog mehr Rauch ins Treppenhaus. Auch wenn du die Tür später schließt, bleibt der Rauch, der schon im Treppenhaus ist.</p>
  <p><strong>Das kannst du dir merken</strong><br>Wenn du bei einem Brand einen Raum verlässt, zieh die Tür hinter dir zu. So breitet sich der Rauch langsamer aus. Geh dafür nie zurück. Geh auch nie in ein verrauchtes Treppenhaus, selbst wenn du dort keine Flammen siehst.</p>
  <p>Rauchmelder erkennen Rauch früh und piepen laut. So können sie dich auch im Schlaf warnen.</p>
  <button type="button" class="action" data-close>Weiter entdecken ${icon('next')}</button>`

const lessons = `
  <header class="sheet-heading"><h2 id="sheet-title">Lernimpuls wählen</h2>${closeButton}</header>
  <div class="lesson-choices">
    <button class="pill" type="button" data-panel="intro" aria-labelledby="intro-label" aria-describedby="intro-description">
      ${icon('door')}<span><strong id="intro-label">Rauchausbreitung</strong><small id="intro-description">Vergleiche, wie viel Rauch bei offener und geschlossener Tür ins Treppenhaus zieht.</small></span>
    </button>
    <button class="pill" type="button" data-panel="fireIntro" aria-labelledby="fireIntro-label" aria-describedby="fireIntro-description">
      ${icon('flame')}<span><strong id="fireIntro-label">Raumdurchzündung</strong><small id="fireIntro-description">Beobachte, wie erst Flammen im Rauch aufflackern und dann die Möbel Feuer fangen.</small></span>
    </button>
  </div>`

const fireIntro = `
  <header class="sheet-heading"><span class="lesson-icon">${icon('bulb')}</span>${closeButton}</header>
  <h2 id="sheet-title">Wie wird aus einem kleinen Feuer ein Zimmerbrand?</h2>
  <p>Am Fernseher im ersten Stock entsteht ein Feuer. Wo werden die nächsten Flammen sichtbar? Schau zuerst zum Fernseher und dann zur Zimmerdecke.</p>
  <p>Der Versuch läuft im Zeitraffer und hält an zwei Stellen an. Mit „Beobachtung zeigen“ siehst du die nächste Beobachtung.</p>
  <button type="button" class="action" data-start="fire">Feuerversuch starten ${icon('next')}</button>`

const fireResult = `
  <header class="sheet-heading"><span class="lesson-icon">${icon('eye')}</span>${closeButton}</header>
  <h2 id="sheet-title">Wo hast du neue Flammen gesehen?</h2>
  <p>Was brannte, als du die Flammen unter der Decke gesehen hast? Was hast du an den Möbeln gesehen, bevor sie Feuer fingen?</p>
  <button type="button" class="action" data-panel="fireFindings">Ergebnis ansehen ${icon('next')}</button>`

const fireFindings = `
  <header class="sheet-heading"><span class="lesson-icon">${icon('eye')}</span>${closeButton}</header>
  <h2 id="sheet-title">Wie sich das Feuer im Zimmer ausgebreitet hat</h2>
  <div class="scene-comparison">
    <figure data-view="outgassing"><figcaption>Ausgasen der Möbel</figcaption></figure>
    <figure data-view="flashover"><figcaption>Vollbrand im Zimmer</figcaption></figure>
  </div>
    <p>Über dem Fernseher sammelten sich heiße Brandgase. Wo sie sich mit Luft mischten, waren kurz Flammenzungen zu sehen. Breiten sich die Flammen durch die heiße Gasschicht unter der Decke aus, heißt das <strong>Rollover</strong>.</p>
    <p>Die Hitze erwärmt auch Polster, Holz und Stoff im Zimmer. Aus diesen Materialien können brennbare Gase austreten. Im Modell machen die hellen Schlieren das sichtbar. So können auch Möbel Feuer fangen, die die Flammen vom Fernseher noch gar nicht berührt haben.</p>
    <p>Fast gleichzeitig fingen Möbel, Stoffe und sogar die Blätter der Pflanze im Modell Feuer. Diesen Übergang zum Vollbrand nennt man <strong>Raumdurchzündung</strong> oder <strong>Flashover</strong>.</p>
    <p>Jeder Brand kann anders verlaufen. Die Zeit im Modell ist für die Vorführung verkürzt.</p>
  <button type="button" class="action" data-close>Weiter entdecken ${icon('next')}</button>`

const panels = { help, lessons, intro, result, smokeFindings, fireIntro, fireResult, fireFindings }
export type PanelKind = keyof typeof panels

const descriptions = {
  open: 'Rauch verdeckt den oberen Teil der Treppe vor der Brandwohnung.',
  closed: 'Die Treppe vor der Brandwohnung ist klar zu sehen.',
  outgassing: 'Helle Schlieren steigen über den erhitzten Möbeln auf.',
  flashover: 'An mehreren Möbeln im Zimmer sind gleichzeitig Flammen zu sehen.',
}
export type LessonViews = Partial<Record<keyof typeof descriptions, HTMLCanvasElement>>

/** Show a native modal and report the selected lesson when it closes. */
export function showPanel(
  kind: PanelKind,
  onClose: (lesson: Lesson | null) => void,
  views: LessonViews,
) {
  const dialog = element<HTMLDialogElement>('sheet')
  const body = element('sheet-body')
  if (dialog.open) return
  let selected: Lesson | null = null
  function render(panel: PanelKind) {
    body.innerHTML = panels[panel]
    for (const figure of body.querySelectorAll<HTMLElement>('figure[data-view]')) {
      const key = figure.dataset.view as keyof typeof descriptions
      const image = views[key]
      if (image) {
        image.setAttribute('role', 'img')
        image.setAttribute('aria-label', descriptions[key])
        figure.append(image)
      }
    }
    for (const button of body.querySelectorAll<HTMLButtonElement>('[data-close]')) {
      button.onclick = () => dialog.close()
    }
    for (const button of body.querySelectorAll<HTMLButtonElement>('[data-panel]')) {
      button.onclick = () => {
        render(button.dataset.panel as PanelKind)
        const heading = element('sheet-title')
        heading.tabIndex = -1
        heading.focus()
      }
    }
    const begin = body.querySelector<HTMLButtonElement>('[data-start]')
    if (begin) begin.onclick = () => {
      selected = begin.dataset.start as Lesson
      dialog.close()
    }
  }
  render(kind)
  dialog.onclose = () => onClose(selected)
  dialog.onclick = (event) => {
    if (event.target === dialog) {
      const box = dialog.getBoundingClientRect()
      if (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      )
        dialog.close()
    }
  }
  dialog.showModal()
}
