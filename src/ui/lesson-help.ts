import { icon } from './icons'

const instructions = {
  brandhaus: {
    explore: 'Wähle im Modell ein oranges Rauchzeichen. Die Flamme bleibt bei diesem Versuch am selben Ort. Öffne oder schließe eine Tür im Modell. Wohin zieht der Rauch?',
    view: 'Wähle eine Etage. Verschiebe das Bild mit Maus, Finger oder Pfeiltasten. Das Hauszeichen zeigt wieder alle Etagen.',
    lesson: 'Wähle „Lernimpuls“ und dann einen Versuch zu Rauch oder Feuer. Erkennt ein Melder im Modell Rauch, blinkt er rot. Mit dem Lautsprecher schaltest du den Modellton ein.',
  },
  verbrennungsdreieck: {
    explore: 'Tippe ins Dreieck oder zieh den Knopf. In der Mitte siehst du das Holzfeuer vom Anfang. Zieh den Knopf von dort zur Ecke links unten. So siehst du, was bei weniger Sauerstoff passiert.',
    view: 'Zieh mit der Maus oder dem Finger seitlich über die Ofenscheibe. Auch die Pfeiltasten links und rechts drehen den Ofen.',
    lesson: 'Wähle „Lernimpuls“. Holz ist der Brennstoff. Damit es mit Flammen brennt, muss es heiß genug sein und Sauerstoff aus der Luft bekommen.',
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
