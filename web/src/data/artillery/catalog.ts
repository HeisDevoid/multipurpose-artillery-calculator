
import mk6Data from './mk6.json'
import m252Data from './m252_rhsusaf.json'
import m29Data from './m29_sog.json'
import m2Data from './m2_sog.json'
import m101Data from './m101_sog.json'
import searaData from './seara.json'
import d44Data from './d44_sog.json'
import h12Data from './h12_sog.json'
import kamazData from './kamaz_mrl.json'
import m109a6Data from './m109a6_rhsusaf.json'
import m119a2Data from './m119a2_rhsusaf.json'
import m777Data from './m777_sod.json'
import sholefData from './sholef.json'
import sochorData from './sochor.json'
import type53Data from './type53_sog.json'
import type63Data from './type63_sog.json'
import d30Data from './d30_rhs.json'
import gvozdikaData from './gvozdika_rhs.json'
import bm21Data from './bm21_rhs.json'
import podnosData from './podnos_rhs.json'
import himarsData from './himars_rhs.json'

import { parseReference } from './parse'

export { parseReference }

// Все таблицы сразу — для проверок и инструментов; приложение грузит их по одной (tables.ts)
export const artilleryCatalog = {
  mk6: parseReference(mk6Data, 'mk6'),
  m252_rhsusaf: parseReference(
    m252Data,
    'm252_rhsusaf'
  ),
  m29_sog: parseReference(m29Data, 'm29_sog'),
  m2_sog: parseReference(m2Data, 'm2_sog'),
  m101_sog: parseReference(m101Data, 'm101_sog'),
  seara: parseReference(searaData, 'seara'),
  d44_sog: parseReference(d44Data, 'd44_sog'),
  h12_sog: parseReference(h12Data, 'h12_sog'),
  kamaz_mrl: parseReference(kamazData, 'kamaz_mrl'),
  m109a6_rhsusaf: parseReference(m109a6Data, 'm109a6_rhsusaf'),
  m119a2_rhsusaf: parseReference(m119a2Data, 'm119a2_rhsusaf'),
  m777_sod: parseReference(m777Data, 'm777_sod'),
  sholef: parseReference(sholefData, 'sholef'),
  sochor: parseReference(sochorData, 'sochor'),
  type53_sog: parseReference(type53Data, 'type53_sog'),
  type63_sog: parseReference(type63Data, 'type63_sog'),
  d30_rhs: parseReference(d30Data, 'd30_rhs'),
  gvozdika_rhs: parseReference(gvozdikaData, 'gvozdika_rhs'),
  bm21_rhs: parseReference(bm21Data, 'bm21_rhs'),
  podnos_rhs: parseReference(podnosData, 'podnos_rhs'),
  himars_rhs: parseReference(himarsData, 'himars_rhs'),
}
