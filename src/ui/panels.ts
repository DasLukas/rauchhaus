import { HOUSE_VARIANT } from '../simulation'
import { icon } from './icons'
import { element } from './dom'
import type { Lesson } from './session'

const closeButton = `<button class="close compact" data-close type="button" aria-label="Schließen">${icon('close')}</button>`

const help = `
  <header class="sheet-heading"><h2 id="sheet-title">So geht’s</h2>${closeButton}</header>
  <ul class="help-list">
    <li><i class="key source">${icon('smoke')}</i><div><strong>Versuch starten</strong><p>Wähle ein oranges Rauchzeichen. Dort beginnt das Feuer.</p></div></li>
    <li><i class="key door">${icon('door')}</i><div><strong>Tür auf, Tür zu</strong><p>Wähle die Tür oder ihr türkisfarbenes Zeichen.</p></div></li>
    <li><i class="key neutral">${icon('house')}</i><div><strong>Näher hinschauen</strong><p>Wähle eine Etage. Ziehe das Bild mit der Maus oder dem Finger. Auch die Pfeiltasten verschieben es. Das Hauszeichen zeigt alle Etagen.</p></div></li>
    <li><i class="key neutral">${icon('alarm')}</i><div><strong>Rauchmelder entdecken</strong><p>Bei Rauch blinkt er rot. Schalte den Ton ein. Sein Piepen kann dich auch nachts wecken.</p></div></li>
  </ul>
  <button type="button" class="action" data-close>Verstanden</button>`

const intro = `
  <header class="sheet-heading"><span class="lesson-icon">${icon('bulb')}</span>${closeButton}</header>
  <h2 id="sheet-title">Wohin zieht der Rauch?</h2>
  <p>Im ersten Stock brennt der Fernseher. Schau ins Treppenhaus ${HOUSE_VARIANT === 'klein' ? 'rechts' : 'in der Mitte'}. Im ersten Versuch ist die Wohnungstür offen. Im zweiten ist sie zu.</p>
  <button type="button" class="action" data-start="doors">Versuch starten ${icon('next')}</button>`

const result = `
  <header class="sheet-heading"><span class="lesson-icon">${icon('eye')}</span>${closeButton}</header>
  <h2 id="sheet-title">Wann war mehr Rauch im Treppenhaus?</h2>
  <p>Denk an die offene Tür und an die geschlossene Tür.</p>
  <button type="button" class="action" data-panel="smokeFindings">Ergebnis ansehen ${icon('next')}</button>`

const smokeFindings = `
  <header class="sheet-heading"><span class="lesson-icon">${icon('eye')}</span>${closeButton}</header>
  <h2 id="sheet-title">Eine geschlossene Tür bremst den Rauch.</h2>
  <div class="scene-comparison">
    <figure data-view="open"><figcaption>Tür offen</figcaption></figure>
    <figure data-view="closed"><figcaption>Tür geschlossen</figcaption></figure>
  </div>
  <p>Durch die offene Tür zog Rauch ins Treppenhaus. Rauch im Treppenhaus ist gefährlich.</p>
  <p><strong>Wenn es brennt</strong><br>Zieh beim Rausgehen die Tür hinter dir zu. Geh dafür nie zurück. Geh nie in ein verrauchtes Treppenhaus.</p>
  <button type="button" class="action" data-close>Weiter entdecken ${icon('next')}</button>`

const lessons = `
  <header class="sheet-heading"><h2 id="sheet-title">Was möchtest du entdecken?</h2>${closeButton}</header>
  <div class="lesson-choices">
    <button class="pill" type="button" data-panel="intro" aria-labelledby="intro-label" aria-describedby="intro-description">
      ${icon('door')}<span><strong id="intro-label">Wohin zieht der Rauch?</strong><small id="intro-description">Teste eine offene und eine geschlossene Tür.</small></span>
    </button>
    <button class="pill" type="button" data-panel="fireIntro" aria-labelledby="fireIntro-label" aria-describedby="fireIntro-description">
      ${icon('flame')}<span><strong id="fireIntro-label">Wie breitet sich Feuer aus?</strong><small id="fireIntro-description">Vom Fernseher bis zum ganzen Zimmer.</small></span>
    </button>
  </div>`

const fireIntro = `
  <header class="sheet-heading"><span class="lesson-icon">${icon('bulb')}</span>${closeButton}</header>
  <h2 id="sheet-title">Wie breitet sich Feuer aus?</h2>
  <p>Der Fernseher brennt. Schau an die Zimmerdecke. Wo entdeckst du die nächsten Flammen?</p>
  <p>Das Modell hält zweimal an. Dann kannst du in Ruhe schauen.</p>
  <button type="button" class="action" data-start="fire">Feuerversuch starten ${icon('next')}</button>`

const fireResult = `
  <header class="sheet-heading"><span class="lesson-icon">${icon('eye')}</span>${closeButton}</header>
  <h2 id="sheet-title">Was hast du an den Möbeln entdeckt?</h2>
  <p>Denk an den Moment, bevor die Möbel Feuer fingen.</p>
  <button type="button" class="action" data-panel="fireFindings">Ergebnis ansehen ${icon('next')}</button>`

const fireFindings = `
  <header class="sheet-heading"><span class="lesson-icon">${icon('eye')}</span>${closeButton}</header>
  <h2 id="sheet-title">So breitete sich das Feuer aus</h2>
  <div class="scene-comparison">
    <figure data-view="outgassing"><figcaption>Gas steigt auf</figcaption></figure>
    <figure data-view="flashover"><figcaption>Das Zimmer brennt</figcaption></figure>
  </div>
  <p>Unter der Decke brannten heiße Gase. Dort hast du die kurzen Flammen gesehen.</p>
  <p>Aus den heißen Möbeln steigt Gas auf. Im Modell siehst du es als helle Schlieren. Das Gas kann brennen. Kurz darauf brannten viele Dinge im Zimmer fast gleichzeitig.</p>
  <h3 class="fire-terms">Wie nennt das die Feuerwehr?</h3>
    <p><strong>Rollover</strong> heißt es, wenn sich Flammen in den heißen Gasen unter der Decke ausbreiten.</p>
    <p>Der schnelle Übergang zum Vollbrand heißt <strong>Raumdurchzündung</strong> oder <strong>Flashover</strong>.</p>
  <button type="button" class="action" data-close>Weiter entdecken ${icon('next')}</button>`

const panels = { help, lessons, intro, result, smokeFindings, fireIntro, fireResult, fireFindings }
export type PanelKind = keyof typeof panels

const descriptions = {
  open: 'Oben ist die Treppe von Rauch verdeckt.',
  closed: 'Die Treppe ist gut zu sehen.',
  outgassing: 'Über den Möbeln steigen helle Schlieren auf.',
  flashover: 'Mehrere Möbel brennen gleichzeitig.',
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
