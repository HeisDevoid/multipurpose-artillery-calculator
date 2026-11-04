import { artilleryCatalog } from './catalog'
import { TABLE_OF } from './tables'

import type { ModelId } from '../models'
import type { ArtilleryReference } from '../../types/artillery'

// Все орудия с таблицами сразу — для проверок и инструментов. Приложение
// грузит таблицы по одной (tables.ts), карта орудий там же.
export const artilleryRegistry = Object.fromEntries(
  Object.entries(TABLE_OF).map(([model, file]) => [model, artilleryCatalog[file]])
) as Record<ModelId, ArtilleryReference>
