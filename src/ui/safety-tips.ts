import type { InfoId } from '../simulation/house'

/** German text for a safety marker and its reading dialog. */
export interface SafetyTip {
  readonly title: string
  readonly text: string
}

export const safetyTips = {
  info_stove: {
    title: 'Halte die Herdplatten frei',
    text: 'Ein Geschirrtuch oder ein Topflappen kann auf einer heißen Herdplatte Feuer fangen. Lege beides neben den Herd, wenn du beim Kochen hilfst.',
  },
  info_doors: {
    title: 'Eine Tür bremst den Rauch',
    text: 'Geschlossene Zimmer- und Wohnungstüren bremsen den Rauch. Das gibt dir Zeit. Durch die Spalten an einer geschlossenen Tür kann trotzdem Rauch kommen.',
  },
  info_alarm: {
    title: 'Der Rauchmelder warnt dich',
    text: 'Rauchmelder sind in Zimmern Pflicht, in denen Menschen schlafen, auch im Kinderzimmer. Das gilt auch für den Flur, über den du die Wohnung verlässt. Der laute Alarm warnt früh und kann dich im Schlaf wecken.',
  },
  info_electric: {
    title: 'Elektrogeräte sicher benutzen',
    text: 'Elektrogeräte sind eine häufige Brandursache. Ist das Kabel der Lampe rissig, lass sie aus und sag einem Erwachsenen Bescheid. Decke eine Lampe nie mit einem Tuch ab. Es kann zu heiß werden und brennen.',
  },
  info_cellar: {
    title: 'Halte die Kellertür geschlossen',
    text: 'Die Tür zwischen Keller und Treppe soll nach dem Durchgehen wieder zu sein. Bleibt sie bei einem Kellerbrand offen, kann Rauch durchs Treppenhaus bis ganz nach oben ziehen.',
  },
  info_candle: {
    title: 'Eine Kerze braucht Abstand',
    text: 'Papier und Vorhänge können an einer Kerzenflamme Feuer fangen. Halte sie von der Kerze fern. Solange die Kerze brennt, bleibt ein Erwachsener dabei.',
  },
  info_stairs: {
    title: 'Halte die Treppe frei',
    text: 'Über einen Blumentopf auf dem Treppenabsatz kann jemand stolpern. Hier brauchen alle einen freien Weg nach draußen. Auch Kartons gehören nicht ins Treppenhaus, denn sie können brennen.',
  },
  info_emergency: {
    title: 'Bei Rauch im Treppenhaus',
    text: 'Ist Rauch im Treppenhaus, lass die Wohnungstür zu. Ruf aus einem rauchfreien Zimmer die Feuerwehr unter 112 und sag, wo du bist. Mach dich am Fenster bemerkbar, wenn du es sicher erreichen kannst.',
  },
} as const satisfies Record<InfoId, SafetyTip>
