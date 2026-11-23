import './style.css'
import { pageForSearch } from './navigation'
import { element } from './ui/dom'

const root = element('app')
const page = pageForSearch(location.search)
root.dataset.page = page

async function openPage() {
  if (page === 'brandhaus') {
    document.title = 'Brandhaus · Brandschutz entdecken'
    await import('./brandhaus')
  } else if (page === 'verbrennungsdreieck') {
    document.title = 'Verbrennungsdreieck · Brandschutz entdecken'
    const { mountTriangle } = await import('./triangle')
    mountTriangle(root)
  } else {
    const { mountDashboard } = await import('./dashboard')
    mountDashboard(root)
  }
}

void openPage().catch(() => {
  root.innerHTML = `<section class="module-error" role="alert">
    <h1>Die Lektion konnte nicht geladen werden.</h1>
    <p>Prüfe deine Verbindung und versuche es noch einmal.</p>
    <button type="button" class="action">Erneut laden</button>
    <a class="pill" href="./">Zur Übersicht</a>
  </section>`
  root.querySelector('button')?.addEventListener('click', () => location.reload())
})
