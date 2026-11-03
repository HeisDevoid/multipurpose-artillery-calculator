
import { artilleryCatalog } from './catalog'

import type { ModelId } from '../models'
import type { ArtilleryReference } from '../../types/artillery'

// Связываем ID интерфейса с JSON-справочниками.
export const artilleryRegistry = {
  mk6: artilleryCatalog.mk6,
  m252: artilleryCatalog.m252_rhsusaf,
  m29: artilleryCatalog.m29_sog,
  m2: artilleryCatalog.m2_sog,
  m101: artilleryCatalog.m101_sog,
  seara: artilleryCatalog.seara,
  d44: artilleryCatalog.d44_sog,
  h12: artilleryCatalog.h12_sog,
  kamaz: artilleryCatalog.kamaz_mrl,
  m109a6: artilleryCatalog.m109a6_rhsusaf,
  m119a2: artilleryCatalog.m119a2_rhsusaf,
  m777: artilleryCatalog.m777_sod,
  sholef: artilleryCatalog.sholef,
  sochor: artilleryCatalog.sochor,
  type53: artilleryCatalog.type53_sog,
  type63: artilleryCatalog.type63_sog,
  d30: artilleryCatalog.d30_rhs,
  gvozdika: artilleryCatalog.gvozdika_rhs,
  bm21: artilleryCatalog.bm21_rhs,
  podnos: artilleryCatalog.podnos_rhs,
  himars: artilleryCatalog.himars_rhs,
} satisfies Record<ModelId, ArtilleryReference>
