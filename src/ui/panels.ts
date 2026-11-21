import { icon } from './icons'
import { element } from './layout'

const closeButton = `<button class="close compact" data-close type="button" aria-label="Schließen">${icon('close')}</button>`

const help = `
  <header class="sheet-heading"><h2 id="sheet-title">So geht’s</h2>${closeButton}</header>
  <ul class="help-list">
    <li><i class="key source">${icon('smoke')}</i><div><strong>Rauch beobachten</strong><p>Tippe auf ein oranges Rauchzeichen. Schau, was zuerst an der Decke passiert.</p></div></li>
    <li><i class="key door">${icon('door')}</i><div><strong>Türen ausprobieren</strong><p>Tippe auf eine Tür oder ihr türkises Zeichen. Mit jedem Tipp öffnet oder schließt sie sich.</p></div></li>
    <li><i class="key neutral">${icon('house')}</i><div><strong>Genauer hinschauen</strong><p>Tippe in eine Etage zum Vergrößern. Wische seitlich zum Drehen. Das Hauszeichen zeigt wieder alle Etagen.</p></div></li>
    <li><i class="key neutral">${icon('alarm')}</i><div><strong>Rauchwarnmelder</strong><p>Erreicht Rauch einen Melder, erscheint dort das Alarmzeichen.</p></div></li>
  </ul>
  <details><summary>Für Erwachsene</summary><p>Das vereinfachte Modell zeigt, wie warmer Rauch aufsteigt, sich unter der Decke sammelt und durch Öffnungen weiterzieht. Geschlossene Türen bremsen ihn. Die Abläufe erlauben keine Aussage über sichere Aufenthalts- oder Fluchtzeiten.</p>
  <p>Das Haus lässt sich mit der Tabulatortaste erkunden. Eingabe oder Leertaste betätigen markierte Tasten. In der 3D-Ansicht drehen die Pfeiltasten das Haus, die Tasten 1 bis 4 wählen eine Etage und Pos1 zeigt das ganze Haus.</p><p><a href="https://github.com/DasLukas/rauchhaus" target="_blank" rel="noopener">Projekt, Quellen und Lizenzen</a></p></details>
  <button type="button" class="action" data-close>Verstanden</button>`

const intro = `
  <header class="sheet-heading"><span class="lesson-icon">${icon('bulb')}</span>${closeButton}</header>
  <h2 id="sheet-title">Was passiert im Treppenhaus?</h2>
  <p>Im Wohnzimmer entsteht Rauch am Fernseher. Was glaubst du: Wohin zieht er, wenn die Wohnungstür offen ist?</p>
  <p>Beobachte den Flur rechts. Danach probierst du denselben Versuch mit geschlossener Tür.</p>
  <button type="button" class="action" data-start>Versuch starten ${icon('next')}</button>`

const result = `
  <header class="sheet-heading"><span class="lesson-icon">${icon('eye')}</span>${closeButton}</header>
  <h2 id="sheet-title">Was war anders?</h2>
  <p>Erzähl, wie der Flur bei offener und bei geschlossener Wohnungstür aussah.</p>
  <details class="discovery"><summary>Beobachtung vergleichen</summary><p><strong>Eine geschlossene Tür bremst den Rauch.</strong> Durch die offene Tür zog mehr Rauch in den Flur. Wenn du die Tür später schließt, bleibt bereits eingedrungener Rauch im Flur.</p></details>
  <button type="button" class="action" data-close>Weiter entdecken ${icon('next')}</button>`

export type PanelKind = 'help' | 'intro' | 'result'

/** Shows a native modal; the caller controls experiment time while it is open. */
export function showPanel(kind: PanelKind, onClose: (start: boolean) => void) {
  const dialog = element<HTMLDialogElement>('sheet')
  const body = element('sheet-body')
  if (dialog.open) return
  body.innerHTML = { help, intro, result }[kind]
  let start = false
  for (const button of body.querySelectorAll<HTMLButtonElement>('[data-close]')) {
    button.onclick = () => dialog.close()
  }
  const begin = body.querySelector<HTMLButtonElement>('[data-start]')
  if (begin)
    begin.onclick = () => {
      start = true
      dialog.close()
    }
  dialog.onclose = () => onClose(start)
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
