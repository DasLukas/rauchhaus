import { describe, expect, it } from 'vitest'
import { pageForSearch } from '../src/navigation'

describe('lesson navigation', () => {
  it.each(['', '?utm_source=flyer', '?modul=unbekannt', '?modul=unbekannt&haus=gross'])(
    'opens the overview for %s',
    (search) => expect(pageForSearch(search)).toBe('dashboard'),
  )

  it.each(['?haus=klein', '?haus=gross', '?feuer=1', '?haus=gross&feuer=1', '?modul=brandhaus'])(
    'opens the house for %s',
    (search) => expect(pageForSearch(search)).toBe('brandhaus'),
  )

  it('prioritizes the selected lesson over inherited house options', () => {
    expect(pageForSearch('?modul=verbrennungsdreieck&haus=gross&feuer=1')).toBe('verbrennungsdreieck')
  })
})
