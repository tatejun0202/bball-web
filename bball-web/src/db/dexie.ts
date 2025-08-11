// src/db/dexie.ts (修正版)
import Dexie, { type Table } from 'dexie'

export interface Session { 
  id?: number
  startedAt: number
  endedAt?: number
  note?: string
  // ★ V2追加: セッションのモード識別
  mode?: 'spot' | 'free'  // spot=固定スポット, free=自由配置
}

export interface Zone { 
  id?: number
  name: string
  is3pt: boolean
  orderIndex: number
}

// ★ V2拡張: 自由配置対応
export interface DrillResult { 
  id?: number
  sessionId: number
  zoneId: number
  attempts: number
  makes: number
  createdAt: number
  
  // V1互換: 固定スポット用（既存データ）
  spotId?: number
  
  // ★ V2新機能: 自由配置座標
  freeX?: number  // 0.0-1.0の相対座標
  freeY?: number  // 0.0-1.0の相対座標
  
  // ★ どちらの方式で記録されたかを識別
  positionType?: 'fixed' | 'free'  // fixed=固定スポット, free=自由配置
}

class AppDB extends Dexie {
  sessions!: Table<Session, number>
  zones!: Table<Zone, number>
  drillResults!: Table<DrillResult, number>
  
  constructor() {
    super('bball_db')
    
    // v1: 初期バージョン
    this.version(1).stores({
      sessions: '++id, startedAt, endedAt',
      zones: '++id, orderIndex, is3pt',
      drillResults: '++id, sessionId, zoneId, createdAt',
    })
    
    // v2: 直近レコード高速取得用
    this.version(2).stores({
      drillResults: '++id, sessionId, zoneId, createdAt, [sessionId+createdAt]',
    })
    
    // v3: 固定スポット対応
    this.version(3).stores({
      sessions: '++id, startedAt, endedAt',
      zones: '++id, orderIndex, is3pt',
      drillResults: '++id, sessionId, zoneId, spotId, createdAt, [sessionId+createdAt]',
    })
    
    // ★ v5: セッションモード対応
    this.version(5).stores({
      sessions: '++id, startedAt, endedAt, mode',
      zones: '++id, orderIndex, is3pt',
      drillResults: '++id, sessionId, zoneId, spotId, freeX, freeY, positionType, createdAt, [sessionId+createdAt]',
    })
  }
}

export const db = new AppDB()