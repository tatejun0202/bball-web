import { db } from './dexie'

export async function ensureSeedZones() {
  const count = await db.zones.count()
  if (count > 0) return
  await db.zones.bulkAdd([
    { name: 'Layup',   is3pt: false, orderIndex: 1 },
    { name: 'Mid L',   is3pt: false, orderIndex: 2 },
    { name: 'Mid R',   is3pt: false, orderIndex: 3 },
    { name: 'Corner L',is3pt: true,  orderIndex: 4 },
    { name: 'Top 3',   is3pt: true,  orderIndex: 5 },
    { name: 'Corner R',is3pt: true,  orderIndex: 6 },
  ])
}
