import { db, type Zone } from './dexie'
import Dexie from 'dexie'
import { SPOTS } from '@/constants/spots'
import type { NewDrillResult } from './types'

export async function startSession(note?: string) {
  return db.sessions.add({ startedAt: Date.now(), note })
}
export async function endSession(sessionId: number) {
  await db.sessions.update(sessionId, { endedAt: Date.now() })
}
export async function getOrCreateActiveSession(noteForNew?: string): Promise<number> {
  const last = await db.sessions.orderBy('id').last()
  if (last && !last.endedAt) return last.id!
  return startSession(noteForNew)
}
/** 追加: 単一セッション取得 */
export async function getSession(sessionId: number) {
  return db.sessions.get(sessionId)
}

/** 追加: セッション名（note）を更新 */
export async function updateSessionTitle(sessionId: number, title: string) {
  await db.sessions.update(sessionId, { note: title })
}
export async function listZones(): Promise<Zone[]> {
  return db.zones.orderBy('orderIndex').toArray()
}

export async function ensureSeedZones() {
  const count = await db.zones.count()
  if (count > 0) return
  const rows: Omit<Zone, 'id'>[] = [
    { orderIndex: 1, is3pt: false, name: '2P' },
    { orderIndex: 2, is3pt: true,  name: '3P' }
  ]
  await db.zones.bulkAdd(rows)
}


export async function addDrillResult(input: NewDrillResult) {
  // Dexieのテーブル型と一致していればそのままでOK
  return db.drillResults.add(input as unknown as Parameters<typeof db.drillResults.add>[0])
  // ↑ テーブル型が合っていれば「as unknown as …」は外してOK
}
export async function getSessionSummary(sessionId: number) {
  const rows = await db.drillResults.where('sessionId').equals(sessionId).toArray()
  const zones = await db.zones.toArray()
  const zmap = new Map(zones.map(z => [z.id!, z.is3pt]))
  const total = rows.reduce((a, r) => {
    const is3 = r.spotId ? SPOTS.find(s=>s.id===r.spotId)?.is3pt ?? zmap.get(r.zoneId) : zmap.get(r.zoneId)
    a.attempts += r.attempts
    a.makes += r.makes
    if (is3) { a.a3 += r.attempts; a.m3 += r.makes } else { a.a2 += r.attempts; a.m2 += r.makes }
    return a
  }, { attempts:0, makes:0, a2:0, m2:0, a3:0, m3:0 })
  const pct = (n:number,d:number)=> d? n/d:0
  return {
    total,
    fg: pct(total.makes,total.attempts),
    p2: pct(total.m2,total.a2),
    p3: pct(total.m3,total.a3),
    efg: pct(total.m2 + 1.5*total.m3, total.a2 + total.a3),
  }
}

export async function listSessions() {
  return db.sessions.orderBy('startedAt').reverse().toArray()
}

export async function getLastSessionId() {
  const last = await db.sessions.orderBy('id').last()
  return last?.id
}

// 直近登録の取り消し（Undo用・任意）
export async function undoLastDrill(sessionId: number) {
  const last = await db.drillResults
    .where('[sessionId+createdAt]')
    .between([sessionId, Dexie.minKey], [sessionId, Dexie.maxKey])
    .last()
  if (last?.id) await db.drillResults.delete(last.id)
}

export async function getSessionZoneBreakdown(sessionId: number) {
  const rows = await db.drillResults.where('sessionId').equals(sessionId).toArray()
  const zones = await db.zones.toArray()
  const byZone = new Map<number, {name:string; is3pt:boolean; att:number; mk:number}>()

  for (const z of zones) byZone.set(z.id!, { name: z.name, is3pt: z.is3pt, att:0, mk:0 })
  for (const r of rows) {
    const z = byZone.get(r.zoneId)
    if (z) { z.att += r.attempts; z.mk += r.makes }
  }
  return [...byZone.entries()]
    .map(([id, v]) => ({ id, ...v, fg: v.att ? v.mk/v.att : 0 }))
    .sort((a,b)=>a.id - b.id)
}

export async function getSessionSpotBreakdown(sessionId: number) {
  const rows = await db.drillResults.where('sessionId').equals(sessionId).toArray()
  const zones = await db.zones.toArray()
  const zIs3 = new Map(zones.map(z => [z.id!, z.is3pt]))

  const bySpot = new Map<number, { att: number, mk: number }>()
  for (const r of rows) {
    let sid = r.spotId
    // 互換: spotId が無ければ 2P/3P の代表スポットに合算
    if (!sid) {
      const is3 = zIs3.get(r.zoneId) ?? false
      sid = is3 ? 9 /* Top 3 */ : 5 /* Restricted */
    }
    const cur = bySpot.get(sid) ?? { att: 0, mk: 0 }
    cur.att += r.attempts
    cur.mk  += r.makes
    bySpot.set(sid, cur)
  }

  return SPOTS.map(s => {
    const v = bySpot.get(s.id) ?? { att: 0, mk: 0 }
    const fg = v.att ? v.mk / v.att : 0
    return { id: s.id, label: s.label, is3pt: s.is3pt, att: v.att, mk: v.mk, fg }
  })
}

export async function deleteSessionCascade(sessionId: number) {
  await db.transaction('rw', db.drillResults, db.sessions, async () => {
    await db.drillResults.where('sessionId').equals(sessionId).delete()
    await db.sessions.delete(sessionId)
  })
}

/** 複数セッションの一括削除（カスケード） */
export async function deleteSessionsCascade(sessionIds: number[]) {
  if (sessionIds.length === 0) return
  await db.transaction('rw', db.drillResults, db.sessions, async () => {
    for (const id of sessionIds) {
      await db.drillResults.where('sessionId').equals(id).delete()
      await db.sessions.delete(id)
    }
  })
}

/** すべての履歴（sessions / drillResults）を削除 */
export async function clearAllHistory() {
  await db.transaction('rw', db.drillResults, db.sessions, async () => {
    await db.drillResults.clear()
    await db.sessions.clear()
  })
}


