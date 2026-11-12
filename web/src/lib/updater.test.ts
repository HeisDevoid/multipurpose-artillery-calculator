import { describe, expect, it } from 'vitest'

import { checkForUpdate } from './updater'

describe('checkForUpdate', () => {
  it('the browser has no updates: only the Windows app checks', async () => {
    expect(await checkForUpdate()).toBeNull()
  })
})
