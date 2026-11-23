import { icon } from './icons'

const instructions = {
  brandhaus: {
    explore: 'Wähle ein oranges Rauchzeichen. Öffne und schließe Türen. Wohin zieht der Rauch? Mit dem Lautsprecher schaltest du den Alarmton ein.',
    view: 'Wähle eine Etage. Verschiebe das Bild mit Maus, Finger oder Pfeiltasten. Das Hauszeichen zeigt wieder alle Etagen.',
    lesson: 'Wähle „Lernimpuls“ und dann einen Versuch zu Rauch oder Feuer.',
  },
  verbrennungsdreieck: {
    explore: 'Zieh den Knopf oder wähle einen Punkt im Dreieck. Ziehst du ihn vom Luftzeichen weg, bekommt das Feuer weniger Sauerstoff. In der Mitte siehst du wieder das Feuer vom Anfang.',
    view: 'Zieh mit der Maus oder dem Finger seitlich über die Ofenscheibe. Auch die Pfeiltasten links und rechts drehen den Ofen.',
    lesson: 'Wähle „Lernimpuls“. Dort testest du nacheinander Sauerstoff, Wärme und Brennstoff.',
  },
} as const

export function lessonHelp(module: keyof typeof instructions) {
  const { explore, view, lesson } = instructions[module]
  return `<ul class="help-list">
    <li><i class="key neutral">${icon('play')}</i><div><strong>Selbst ausprobieren</strong><p>${explore}</p></div></li>
    <li><i class="key neutral">${icon('eye')}</i><div><strong>Genauer hinschauen</strong><p>${view}</p></div></li>
    <li><i class="key neutral">${icon('bulb')}</i><div><strong>Lernimpuls starten</strong><p>${lesson}</p></div></li>
  </ul>`
}
