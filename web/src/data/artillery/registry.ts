import { artilleryCatalog } from './catalog'
import { TABLE_OF } from './tables'

import type { ModelId } from '../models'
import type { ArtilleryReference } from '../../types/artillery'

// All weapons with tables at once, for checks and tools. The app
// loads the tables one by one (tables.ts), the weapon map is there too.
export const artilleryRegistry = Object.fromEntries(
  Object.entries(TABLE_OF).map(([model, file]) => [model, artilleryCatalog[file]])
) as Record<ModelId, ArtilleryReference>
