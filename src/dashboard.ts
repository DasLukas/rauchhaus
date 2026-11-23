import './dashboard.css'
import { element } from './ui/dom'
import { icon } from './ui/icons'

const lessons = [
  {
    id: 'verbrennungsdreieck',
    title: 'Verbrennungsdreieck',
    description: 'Verschiebe den Knopf. Entdecke, was ein Holzfeuer zum Weiterbrennen braucht.',
  },
  {
    id: 'brandhaus',
    title: 'Brandhaus',
    description: 'Was ändert sich, wenn die Wohnungstür zu ist? Beobachte den Rauch im Modellhaus.',
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
        <p>Erkunde Feuer und Rauch. Lerne, wie du dich bei einem Brand richtig verhältst.</p>
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
        <h3>Verhalten bei einem Wohnungsbrand</h3>
        <ul class="info-sources">
          <li><a href="https://www.feuerwehrverband.de/app/uploads/2020/05/DFV_vfdb_Fachempfehlung_Verhalten_Brandfall_2019b.pdf#page=5">Verhalten im Brandfall (PDF)</a>
            <span>Deutscher Feuerwehrverband und vfdb, Fälle 1 und 3. Wie eine geschlossene Wohnungstür den Rauch bremst und was bei einem freien oder verrauchten Fluchtweg zu tun ist.</span></li>
          <li><a href="https://www.provinzial.de/dam/jcr%3A3765eb23-daaa-4f56-93a9-95c5efa8982e/304001000190_0524_SP_KB_Brandschutzerziehung_Kinder.pdf#page=6">Brandschutzerziehung für Kinder (PDF)</a>
            <span>Provinzial, S. 6–7. Wie Kinder sich in Sicherheit bringen, unter 112 Hilfe rufen und den Warnton eines Rauchmelders kennenlernen.</span></li>
        </ul>
        <h3>Rauch und Feuer im Brandhaus</h3>
        <ul class="info-sources">
          <li><a href="https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.1026r1.pdf#page=48">Wie Rauch durch eine offene Tür zieht (PDF, Englisch)</a>
            <span>NIST, CFAST-Handbuch, Abschnitt 3.4.2. Heißer Rauch steigt auf, sammelt sich unter der Decke und kann in den nächsten Raum strömen.</span></li>
          <li><a href="https://www.nist.gov/glossary-term/24011">Rollover (Flameover)</a> und <a href="https://www.nist.gov/glossary-term/24071">Flashover</a> (Englisch)
            <span>Das NIST-Lexikon erklärt den Unterschied zwischen brennenden Gasen in der Rauchschicht und dem schnellen Übergang zum Vollbrand im Raum.</span></li>
        </ul>
        <h3>Holzfeuer im Verbrennungsdreieck</h3>
        <ul class="info-sources">
          <li><a href="https://www.lfv-bayern.de/media/filer_public/04/70/04704151-06e7-42fe-8dca-6983a2219c21/alles-ueber-feuer-und-rauch-edition-bayern-2026-04-7.pdf#page=16">Alles über Feuer und Rauch (PDF)</a>
            <span>Grundschulordner, Ausgabe Bayern, S. 16 und 44. Das Dreieck zeigt brennbares Material, Sauerstoff und die zum Entzünden nötige Temperatur. Auch der <a href="https://www.feuerwehrverband.nrw/verband/themen/brandschutzerziehung-und-brandschutzaufklaerung">Verband der Feuerwehren in NRW</a> bietet den Ordner für den Unterricht an.</span></li>
          <li><a href="https://research.fs.usda.gov/download/treesearch/7146.pdf#page=6">Flammen und Glut beim Holzfeuer (PDF, Englisch)</a>
            <span>USDA Forest Products Laboratory, Wood Handbook, S. 17–6. Verkohltes Holz kann auch ohne sichtbare Flammen weiterglühen.</span></li>
          <li><a href="https://www.abfallratgeber.bayern.de/haushalte/abfallentsorgung/asche_heiss/index.htm">Heiße Asche</a>
            <span>Der Abfallratgeber Bayern erklärt, warum sich auch in scheinbar kalter Asche noch Glut verbergen kann.</span></li>
        </ul>
        <p>Beide Modelle zeigen Beispiele. Die Farben und die Zeit im Brandhaus zeigen dir nicht, ob ein Fluchtweg sicher ist.</p>
      </div>
      <div id="impressum" hidden>
        <p>Die Angaben zum Betreiber und zur Kontaktaufnahme stehen noch aus.</p>
      </div>
      <div id="datenschutz" hidden>
        <p>Du brauchst kein Konto. Was du im Brandhaus oder am Ofen ausprobierst, bleibt in deinem Browser. Die App verschickt keine Lernantworten.</p>
        <p>Dein Browser merkt sich für diese Sitzung, ob der Lernhinweis leuchten soll. Das steht im Sitzungsspeicher des Tabs. Die App setzt keine Cookies.</p>
        <details>
          <summary>Wer ist für deine Daten verantwortlich?</summary>
          <p>Ich betreibe diese Lern-App als Privatperson. Bei Fragen zu deinen Daten erreichst du mich hier.</p>
          <p>[Vor- und Nachname]<br>
            [Postanschrift]<br>
            [E-Mail-Adresse für Datenschutzfragen]</p>
        </details>
        <details>
          <summary>Was passiert beim Aufruf der Seite?</summary>
          <p>Dein Browser schickt dem Anbieter der Website deine IP-Adresse. An diese Adresse sendet er die Seite, Bilder und Modelle zurück. Welcher Anbieter deine IP-Adresse erhält, hängt von der Webadresse ab.</p>
          <p><strong>brandschutzfrüherziehung.de</strong> und die weiteren Projekt-Domains laufen über statichost.eu (Variable Object Assignment, Schweden). Wenn du zum Beispiel brandschutzfrüherziehung.org öffnest, leitet dich der Anbieter zur .de-Adresse weiter. Er verwendet deine IP-Adresse, um deinem Browser zu antworten. Nach eigenen Angaben verarbeitet er sie im Europäischen Wirtschaftsraum und speichert sie nicht. Er zählt Seitenaufrufe anonym.
            <a href="https://www.statichost.eu/privacy/">Datenschutz bei statichost.eu (Englisch)</a></p>
          <p><strong>daslukas.github.io/rauchhaus/</strong> wird über GitHub Pages ausgeliefert. GitHub speichert die IP-Adresse zum Schutz des Dienstes. Wie lange, richtet sich laut GitHub nach dem Zweck und gesetzlichen Pflichten. Daten können auch in den USA verarbeitet werden. GitHub erläutert die Schutzmaßnahmen, darunter das EU-US-Datenschutzrahmenabkommen und EU-Standardvertragsklauseln, in seiner
            <a href="https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement">Datenschutzerklärung</a>.
            <a href="https://docs.github.com/de/pages/getting-started-with-github-pages/what-is-github-pages#datensammlung">Angaben zu IP-Adressen bei GitHub Pages</a></p>
          <p>Ich nutze diese Hostingdienste, damit du die Lern-App zuverlässig und sicher aufrufen kannst. Das ist mein berechtigtes Interesse nach Art. 6 Abs. 1 Buchst. f DSGVO.</p>
        </details>
        <details>
          <summary>Welche Rechte hast du?</summary>
          <p>Du kannst mich fragen, welche Daten ich über dich verarbeite. Du kannst verlangen, dass falsche Daten berichtigt werden. Unter den gesetzlichen Voraussetzungen kannst du deine Daten löschen lassen, ihre Nutzung einschränken lassen oder eine übertragbare Kopie bekommen.</p>
          <p><strong>Du kannst der Verarbeitung aufgrund meines berechtigten Interesses widersprechen.</strong> Schreib mir dazu, welche Gründe sich aus deiner persönlichen Situation ergeben. Meine Kontaktdaten findest du oben.</p>
          <p>Du kannst dich auch direkt bei einer Datenschutzaufsichtsbehörde beschweren, zum Beispiel dort, wo du wohnst.
            <a href="https://www.datenschutzkonferenz-online.de/datenschutzaufsichtsbehoerden.html">Datenschutzbehörden in Deutschland</a></p>
        </details>
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
