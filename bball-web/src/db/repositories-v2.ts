// src/db/repositories-v2.ts
import { db } from './dexie'
import { SPOTS } from '@/constants/spots'
import type { NewDrillResult } from './types'

// V2: 自由配置対応のデータ保存
export async function addDrillResultV2(input: NewDrillResult, sessionMode: 'spot' | 'free') {
  const now = Date.now()
  
  const drillResult = {
    sessionId: input.sessionId,
    zoneId: input.zoneId,
    attempts: input.attempts,
    makes: input.makes,
    createdAt: now,
    
    // 位置情報の処理
    ...(input.position.type === 'fixed' 
      ? {
          // 固定スポット
          spotId: input.position.spotId,
          positionType: 'fixed' as const
        }
      : {
          // 自由配置
          freeX: input.position.x,
          freeY: input.position.y,
          positionType: 'free' as const
        }
    )
  }
  
  // セッションにモード情報を保存
  await updateSessionMode(input.sessionId, sessionMode)
  
  return db.drillResults.add(drillResult)
}

// セッションモードの更新
export async function updateSessionMode(sessionId: number, mode: 'spot' | 'free') {
  await db.sessions.update(sessionId, { mode })
}

// セッションの全個別シュートデータ取得（V3用）
export async function getSessionShotsV3(sessionId: number) {
  const results = await db.drillResults
    .where('sessionId')
    .equals(sessionId)
    .toArray()
  
  const shots: Array<{
    id: number
    position: { x: number; y: number }
    result: 'make' | 'miss'
    timestamp: number
    attempts: number
    makes: number
  }> = []
  
  results.forEach(result => {
    if (result.positionType === 'free' && result.freeX !== undefined && result.freeY !== undefined) {
      // 自由配置の個別記録
      const attemptCount = result.attempts || 1
      const makeCount = result.makes || 0
      
      // 各試投を個別に記録として展開
      for (let i = 0; i < attemptCount; i++) {
        shots.push({
          id: result.id!,
          position: { x: result.freeX, y: result.freeY },
          result: i < makeCount ? 'make' : 'miss',
          timestamp: result.createdAt || Date.now(),
          attempts: result.attempts || 0,
          makes: result.makes || 0
        })
      }
    } else if (result.positionType === 'fixed' && result.spotId !== undefined) {
      // 固定スポットの記録
      const spot = SPOTS.find(s => s.id === result.spotId)
      if (spot) {
        const attemptCount = result.attempts || 1
        const makeCount = result.makes || 0
        
        for (let i = 0; i < attemptCount; i++) {
          shots.push({
            id: result.id!,
            position: { x: spot.x, y: spot.y },
            result: i < makeCount ? 'make' : 'miss',
            timestamp: result.createdAt || Date.now(),
            attempts: result.attempts || 0,
            makes: result.makes || 0
          })
        }
      }
    }
  })
  
  return shots.sort((a, b) => a.timestamp - b.timestamp)
}

// セッションの全ポジション取得（固定+自由配置）
export async function getSessionPositions(sessionId: number) {
  const results = await db.drillResults
    .where('sessionId')
    .equals(sessionId)
    .toArray()
  
  // 位置別に集計
  const positionMap = new Map<string, {
    attempts: number
    makes: number
    positions: typeof results
  }>()
  
  results.forEach(result => {
    let key: string
    
    if (result.positionType === 'fixed' && result.spotId) {
      key = `fixed:${result.spotId}`
    } else if (result.positionType === 'free' && result.freeX !== undefined && result.freeY !== undefined) {
      // 自由配置は座標を丸めてグルーピング（近い位置をまとめる）
      const roundedX = Math.round(result.freeX * 20) / 20  // 0.05刻み
      const roundedY = Math.round(result.freeY * 20) / 20  // 0.05刻み
      key = `free:${roundedX},${roundedY}`
    } else {
      return // 不正なデータはスキップ
    }
    
    const current = positionMap.get(key) || {
      attempts: 0,
      makes: 0,
      positions: []
    }
    
    current.attempts += result.attempts
    current.makes += result.makes
    current.positions.push(result)
    
    positionMap.set(key, current)
  })
  
  return positionMap
}

// セッション統計の取得（V1互換 + V2拡張）
export async function getSessionSummaryV2(sessionId: number) {
  const results = await db.drillResults
    .where('sessionId')
    .equals(sessionId)
    .toArray()
  
  const summary = {
    total: { attempts: 0, makes: 0 },
    fixed: { attempts: 0, makes: 0 },
    free: { attempts: 0, makes: 0 },
    twoPoint: { attempts: 0, makes: 0 },
    threePoint: { attempts: 0, makes: 0 }
  }
  
  results.forEach(result => {
    summary.total.attempts += result.attempts
    summary.total.makes += result.makes
    
    // 記録方式別
    if (result.positionType === 'fixed') {
      summary.fixed.attempts += result.attempts
      summary.fixed.makes += result.makes
    } else if (result.positionType === 'free') {
      summary.free.attempts += result.attempts
      summary.free.makes += result.makes
    }
    
    // TODO: 2P/3P判定はzoneIdまたは座標から行う
    // 現在は簡易的にzoneIdで判定
    const zone = result.zoneId
    if (zone === 1) { // 2P zone (仮定)
      summary.twoPoint.attempts += result.attempts
      summary.twoPoint.makes += result.makes
    } else if (zone === 2) { // 3P zone (仮定)
      summary.threePoint.attempts += result.attempts
      summary.threePoint.makes += result.makes
    }
  })
  
  // 成功率計算
  const addPercentage = (obj: { attempts: number; makes: number }) => ({
    ...obj,
    percentage: obj.attempts > 0 ? (obj.makes / obj.attempts) * 100 : 0
  })
  
  return {
    total: addPercentage(summary.total),
    fixed: addPercentage(summary.fixed),
    free: addPercentage(summary.free),
    twoPoint: addPercentage(summary.twoPoint),
    threePoint: addPercentage(summary.threePoint),
    efgPercentage: summary.total.attempts > 0 
      ? ((summary.twoPoint.makes + 1.5 * summary.threePoint.makes) / summary.total.attempts) * 100
      : 0
  }
}

// 全セッションの自由配置データ取得（統計用）
export async function getAllFreePositions() {
  const results = await db.drillResults
    .where('positionType')
    .equals('free')
    .toArray()
  
  return results.filter(r => 
    r.freeX !== undefined && 
    r.freeY !== undefined
  ).map(r => ({
    sessionId: r.sessionId,
    x: r.freeX!,
    y: r.freeY!,
    attempts: r.attempts,
    makes: r.makes,
    fgPercentage: r.attempts > 0 ? (r.makes / r.attempts) * 100 : 0,
    createdAt: r.createdAt
  }))
}

// 直近の記録を取り消し（Undo機能）
export async function undoLastDrillV2(sessionId: number) {
  const last = await db.drillResults
    .where('sessionId')
    .equals(sessionId)
    .reverse()
    .first()
  
  if (last?.id) {
    await db.drillResults.delete(last.id)
    return last
  }
  
  return null
}