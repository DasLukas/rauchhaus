import './dashboard.css'
import { icon } from './ui/icons'

const lessons = [
  {
    id: 'brandhaus',
    title: 'Brandhaus',
    description: 'Öffne und schließe Türen. Entdecke, wie sich Rauch im Haus ausbreitet.',
  },
  {
    id: 'verbrennungsdreieck',
    title: 'Verbrennungsdreieck',
    description: 'Verschiebe den Knopf. Entdecke, was ein Holzfeuer zum Brennen braucht.',
  },
] as const

/** Present the two classroom activities without downloading either interactive scene. */
export function mountDashboard(root: HTMLElement): void {
  const base = import.meta.env.BASE_URL
  root.innerHTML = `
    <section class="lesson-dashboard" aria-labelledby="dashboard-heading">
      <header class="dashboard-heading">
        <h1 id="dashboard-heading"><img src="${base}haus.svg" width="58" height="58" alt="">Brandschutz entdecken</h1>
        <p>Welche Lektion möchtest du erkunden?</p>
      </header>
      <nav class="lesson-cards" aria-label="Lektion auswählen">
        ${lessons.map(({ id, title, description }) => `
          <a class="lesson-card" href="?modul=${id}" aria-labelledby="${id}-title" aria-describedby="${id}-intro">
            <img class="lesson-preview" width="920" height="510" src="${base}lessons/${id}.webp" alt="">
            <div class="card-content">
              <h2 id="${id}-title">${title}</h2>
              <p id="${id}-intro">${description}</p>
              <span class="card-arrow" aria-hidden="true">${icon('next')}</span>
            </div>
          </a>`).join('')}
      </nav>
    </section>`
}
