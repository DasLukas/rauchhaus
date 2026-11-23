import './dashboard.css'
import { element } from './ui/dom'
import { icon } from './ui/icons'

const lessons = [
  {
    id: 'verbrennungsdreieck',
    title: 'Verbrennungsdreieck',
    description: 'Verschiebe den Knopf. Entdecke, was ein Feuer zum Brennen braucht.',
  },
  {
    id: 'brandhaus',
    title: 'Brandhaus',
    description: 'Öffne und schließe Türen. Entdecke, wie sich Rauch im Haus ausbreitet.',
  },
] as const

/** Present the two classroom activities without downloading either interactive scene. */
export function mountDashboard(root: HTMLElement): void {
  const base = import.meta.env.BASE_URL
  const topics = [
    { id: 'impressum', title: 'Impressum' },
    { id: 'datenschutz', title: 'Datenschutz' },
    { id: 'fachquellen', title: 'Fachquellen' },
    { id: 'lizenzen', title: 'Lizenzen' },
  ]
  root.innerHTML = `
    <section class="lesson-dashboard" aria-labelledby="dashboard-heading">
      <header class="dashboard-heading">
        <h1 id="dashboard-heading"><img src="${base}haus.svg" width="58" height="58" alt=""><span>Brandschutzfrüherziehung</span></h1>
        <p>Entdecke, wie Feuer entsteht und was du tun kannst, wenn es brennt.</p>
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
    </section>
    <footer class="dashboard-footer">
      <nav aria-label="Informationen zur App">
        ${topics.map(({ id, title }) =>
          `<a href="#${id}" aria-haspopup="dialog">${title}</a>`,
        ).join('')}
      </nav>
    </footer>
    <dialog id="sheet" aria-labelledby="info-title" closedby="any">
      <header class="sheet-heading">
        <h2 id="info-title"></h2>
        <button type="button" class="close compact" id="info-close" aria-label="Schließen" autofocus>${icon('close')}</button>
      </header>
      <div id="fachquellen" hidden>
        <ul class="info-sources">
          <li><a href="https://www.feuerwehrverband.de/app/uploads/2020/05/DFV_vfdb_Fachempfehlung_Verhalten_Brandfall_2019b.pdf">Was tun, wenn es brennt? (PDF)</a>
            <span>vfdb und Deutscher Feuerwehrverband erklären, was bei Feuer in der eigenen Wohnung oder Rauch im Treppenhaus zu tun ist.</span></li>
          <li><a href="https://www.feuerwehrverband.nrw/verband/themen/brandschutzerziehung-und-brandschutzaufklaerung">Alles über Feuer und Rauch</a>
            <span>Unterrichtsmaterial für die Grundschule vom Verband der Feuerwehren in NRW und der Provinzial.</span></li>
          <li><a href="https://www.provinzial.de/dam/jcr%3A3765eb23-daaa-4f56-93a9-95c5efa8982e/304001000190_0524_SP_KB_Brandschutzerziehung_Kinder.pdf">Brandschutz mit Kindern üben (PDF)</a>
            <span>Tipps der Provinzial für Familien zu Fluchtwegen und zum Notruf 112.</span></li>
        </ul>
      </div>
      <div id="impressum" hidden>
        <p>Die Angaben zum Betreiber und zur Kontaktaufnahme stehen noch aus.</p>
      </div>
      <div id="datenschutz" hidden>
        <p>Die Lern-App läuft ohne Konto, Cookies oder Besucherstatistik. Sie merkt sich für diesen Browser-Tab, ob der Hinweis auf einen Lernimpuls noch erscheinen soll. Lernantworten werden nicht übertragen.</p>
        <p>Beim Öffnen der auf GitHub Pages veröffentlichten Seite protokolliert GitHub die IP-Adresse zum Schutz des Dienstes.
          <a href="https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement">Datenschutzerklärung von GitHub</a></p>
      </div>
      <div id="lizenzen" hidden>
        <p>Modelle, Bilder und Lerntexte stammen von <a href="https://github.com/DasLukas/rauchhaus">DasLukas und Mitwirkenden</a>.
          Du darfst sie unter <a href="${base}licenses/CC-BY-4.0.txt">CC BY 4.0</a> weiterverwenden. Nenne die Urheber, verlinke die Lizenz und gib Änderungen an.</p>
        <p><a href="https://github.com/DasLukas/rauchhaus/blob/main/LICENSE">App-Code (MIT)</a> ·
          <a href="${base}licenses/Three-MIT.txt">Three.js (MIT)</a> ·
          <a href="${base}licenses/Nunito-OFL.txt">Schrift Nunito (OFL)</a></p>
      </div>
    </dialog>`
  const dialog = element<HTMLDialogElement>('sheet')
  let openedFromDashboard = false
  function showLinkedTopic(event?: HashChangeEvent) {
    const topic = topics.find(({ id }) => location.hash === `#${id}`)
    if (!topic) {
      if (dialog.open) dialog.close()
      return
    }
    openedFromDashboard = !!event && !new URL(event.oldURL).hash
    for (const { id } of topics) element(id).hidden = id !== topic.id
    element('info-title').textContent = topic.title
    if (!dialog.open) dialog.showModal()
  }
  window.addEventListener('hashchange', showLinkedTopic)
  element('info-close').onclick = () => dialog.close()
  dialog.addEventListener('close', () => {
    if (dialog.open || !topics.some(({ id }) => location.hash === `#${id}`)) return
    if (openedFromDashboard) history.back()
    else history.replaceState(history.state, '', location.pathname + location.search)
  })
  showLinkedTopic()
}
