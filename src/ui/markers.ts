import { DETECTORS, DOORS, SOURCES, type SimulationSnapshot } from '../simulation'
import { icon } from './icons'

interface Position {
  id: string
  x: number
  y: number
  visible: boolean
}
type MarkerKind = 'source' | 'door' | 'detector'

interface Entry {
  view: HTMLElement
  glyph: HTMLElement
  tooltip: HTMLElement
  kind: MarkerKind
  label: string
  on: boolean
  position?: Position
}

/** Accessible HTML controls follow anchors projected from the moving 3D camera. */
export class Markers {
  private readonly entries = new Map<string, Entry>()
  private lesson = false
  constructor(root: HTMLElement, activate: (id: string) => void) {
    const groups = [
      [SOURCES, 'source'],
      [DOORS, 'door'],
      [DETECTORS, 'detector'],
    ] as const
    for (const [items, kind] of groups) {
      for (const item of items) {
        const view = document.createElement(kind === 'detector' ? 'span' : 'button')
        if (view instanceof HTMLButtonElement) {
          view.type = 'button'
          let originX = 0
          let originY = 0
          let moved = false
          view.addEventListener('pointerdown', (event) => {
            originX = event.clientX
            originY = event.clientY
            moved = false
          })
          view.addEventListener('pointermove', (event) => {
            if (event.buttons && Math.hypot(event.clientX - originX, event.clientY - originY) > 7)
              moved = true
          })
          view.addEventListener('click', (event) => {
            if (!moved || event.detail === 0) activate(item.id)
          })
        } else {
          view.setAttribute('role', 'img')
        }
        view.className = `marker ${kind}`
        view.hidden = true
        view.dataset.marker = item.id
        const glyph = document.createElement('i')
        glyph.className = 'marker-disk'
        glyph.innerHTML = icon(
          ({ source: 'smoke', door: 'door', detector: 'alarm' } as const)[kind],
        )
        const tooltip = document.createElement('span')
        tooltip.className = 'tooltip'
        tooltip.setAttribute('aria-hidden', 'true')
        view.append(glyph, tooltip)
        root.append(view)
        this.entries.set(item.id, { view, glyph, tooltip, kind, label: item.label, on: false })
      }
    }
  }

  project(positions: readonly Position[]) {
    for (const pos of positions) {
      const entry = this.entries.get(pos.id)
      if (!entry) continue
      entry.position = pos
      entry.view.style.left = `${pos.x.toFixed(1)}px`
      entry.view.style.top = `${pos.y.toFixed(1)}px`
      this.visibility(entry)
    }
  }

  update(snapshot: SimulationSnapshot, lesson: boolean) {
    this.lesson = lesson
    for (const [id, e] of this.entries) {
      let label = e.label
      if (e.kind === 'door') {
        e.on = snapshot.doors[id as keyof typeof snapshot.doors]
        label += e.on ? ' · offen' : ' · geschlossen'
        e.glyph.innerHTML = icon(e.on ? 'open' : 'door')
        e.view.setAttribute('aria-pressed', String(e.on))
      } else if (e.kind === 'source') {
        e.on = snapshot.source === id
        label += e.on ? ' · Versuch aktiv' : ' · Rauchversuch starten'
        e.view.setAttribute('aria-pressed', String(e.on))
      } else {
        e.on = snapshot.detectors[id as keyof typeof snapshot.detectors]
        label += ' · Rauch erkannt'
      }
      e.tooltip.textContent = label
      e.view.setAttribute('aria-label', label)
      e.view.classList.toggle('active', e.on)
      this.visibility(e)
    }
  }

  private visibility(e: Entry) {
    e.view.hidden =
      !e.position?.visible ||
      (e.kind === 'detector' && !e.on) ||
      (this.lesson &&
        ((e.kind === 'door' && e.view.dataset.marker !== 'd1') || (e.kind === 'source' && !e.on)))
    if (e.view instanceof HTMLButtonElement) e.view.disabled = this.lesson
  }
}
