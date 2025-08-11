import Dexie, { type Table } from 'dexie'

export interface Session { id?: number; startedAt: number; endedAt?: number; note?: string }
export interface Zone { id?: number; name: string; is3pt: boolean; orderIndex: number }
export interface DrillResult { id?: number; sessionId: number; zoneId: number; attempts: number; makes: number; createdAt: number,spotId?: number;}

class AppDB extends Dexie {
  sessions!: Table<Session, number>
  zones!: Table<Zone, number>
  drillResults!: Table<DrillResult, number>
  constructor() {
    super('bball_db')
    // v1
    this.version(1).stores({
      sessions: '++id, startedAt, endedAt',
      zones: '++id, orderIndex, is3pt',
      drillResults: '++id, sessionId, zoneId, createdAt',
    })
    // v2: 直近レコードを高速に取るための複合インデックス
    this.version(2).stores({
      drillResults: '++id, sessionId, zoneId, createdAt, [sessionId+createdAt]',
    })

    this.version(3).stores({
        sessions: '++id, startedAt, endedAt',
        zones: '++id, orderIndex, is3pt',
        drillResults: '++id, sessionId, zoneId, spotId, createdAt, [sessionId+createdAt]',
    })
  }
}

export const db = new AppDB()
