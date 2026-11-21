import { DETECTORS, DOORS, ROOMS, CLASSROOM_SOURCES, type SimulationSnapshot } from '../simulation'
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
  floor: number
  label: string
  on: boolean
  offset?: number
  position?: Position
}

/** Accessible HTML controls follow anchors projected from the moving 3D camera. */
export class Markers {
  private readonly entries = new Map<string, Entry>()
  private lesson = false
  private width = 0
  constructor(
    private readonly root: HTMLElement,
    activate: (id: string) => void,
  ) {
    const groups = [
      [CLASSROOM_SOURCES, 'source'],
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
        const roomId = 'room' in item ? item.room : item.rooms[0]
        const room = ROOMS.find((room) => room.id === roomId)
        if (!room) throw new Error(`Missing room for ${item.id}`)
        this.entries.set(item.id, {
          view,
          glyph,
          tooltip,
          kind,
          floor: room.floor,
          label: item.label,
          on: false,
        })
      }
    }
  }

  project(positions: readonly Position[]) {
    this.width = this.root.clientWidth
    for (const pos of positions) {
      const entry = this.entries.get(pos.id)
      if (!entry) continue
      entry.position = pos
      entry.view.style.left = `${pos.x.toFixed(1)}px`
      entry.view.style.top = `${pos.y.toFixed(1)}px`
      this.visibility(entry)
    }
    this.spaceTargets()
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
    this.spaceTargets()
  }

  /** Keep same-storey tap targets separate on narrow screens. Leave a short
   * leader to the physical anchor if a marker has to move sideways. */
  private spaceTargets() {
    const width = this.width
    if (width < 48) return
    const floors = new Map<number, { entry: Entry; x: number }[]>()
    for (const entry of this.entries.values()) {
      if (entry.kind === 'detector' || !entry.position || entry.view.hidden) continue
      const row = floors.get(entry.floor) ?? []
      row.push({ entry, x: entry.position.x })
      floors.set(entry.floor, row)
    }
    for (const row of floors.values()) {
      row.sort((a, b) => a.x - b.x)
      const spacing = Math.min(50, (width - 48) / Math.max(1, row.length - 1))
      // In these coordinates equally spaced neighbours share one origin.
      // Merge adjacent overlapping groups and centre them on their anchors.
      const groups: { origin: number; size: number }[] = []
      for (const [index, item] of row.entries()) {
        const group = { origin: item.x - index * spacing, size: 1 }
        let previous = groups.at(-1)
        while (previous && previous.origin > group.origin) {
          group.origin =
            (previous.origin * previous.size + group.origin * group.size) /
            (previous.size + group.size)
          group.size += previous.size
          groups.pop()
          previous = groups.at(-1)
        }
        groups.push(group)
      }
      let index = 0
      for (const group of groups) {
        const origin = Math.max(24, Math.min(width - 24 - spacing * (row.length - 1), group.origin))
        for (let j = 0; j < group.size; j++, index++) {
          const { entry, x } = row[index]
          const offset = Math.round((origin + spacing * index - x) * 10) / 10
          if (entry.offset === offset) continue
          entry.offset = offset
          entry.view.style.marginLeft = `${offset.toFixed(1)}px`
          entry.view.style.setProperty('--leader-width', `${Math.abs(offset).toFixed(1)}px`)
          entry.view.style.setProperty('--leader-direction', offset > 0 ? '-1' : '1')
        }
      }
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
