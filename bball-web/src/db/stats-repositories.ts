// src/db/stats-repositories.ts
import { db } from './dexie'
import { SPOTS } from '@/constants/spots'
// import type { Session, DrillResult } from './dexie'

// 基本的な統計データ型
export interface SessionStats {
  sessionId: number
  sessionTitle: string
  date: string
  startedAt: number
  totalAttempts: number
  totalMakes: number
  fgPercentage: number
  attempts2P: number
  makes2P: number
  fg2Percentage: number
  attempts3P: number
  makes3P: number
  fg3Percentage: number
  efgPercentage: number
  points: number
  minutes: number
}

// スポット別統計データ型
export interface SpotStats {
  spotId: number
  spotLabel: string
  is3pt: boolean
  x: number
  y: number
  totalAttempts: number
  totalMakes: number
  fgPercentage: number
  sessions: number // このスポットで練習したセッション数
}

// 時系列統計データ型
export interface TimeSeriesData {
  date: string
  fgPercentage: number
  fg2Percentage: number
  fg3Percentage: number
  totalAttempts: number
  totalMakes: number
  sessionCount: number
}

// 累計統計データ型
export interface OverallStats {
  totalSessions: number
  totalMinutes: number
  totalAttempts: number
  totalMakes: number
  overallFgPercentage: number
  total2PAttempts: number
  total2PMakes: number
  overall2PPercentage: number
  total3PAttempts: number
  total3PMakes: number
  overall3PPercentage: number
  overallEfgPercentage: number
  totalPoints: number
  averageAttemptsPerSession: number
  averageMakesPerSession: number
  bestSession: {
    sessionId: number
    title: string
    fgPercentage: number
    date: string
  } | null
  recentTrend: 'improving' | 'declining' | 'stable'
}

// 全セッションの統計データを取得
export async function getAllSessionsStats(): Promise<SessionStats[]> {
  const sessions = await db.sessions
    .orderBy('startedAt')
    .reverse()
    .toArray()

  const statsPromises = sessions.map(async (session): Promise<SessionStats> => {
    const drillResults = await db.drillResults
      .where('sessionId')
      .equals(session.id!)
      .toArray()

    // 基本集計
    let totalAttempts = 0
    let totalMakes = 0
    let attempts2P = 0
    let makes2P = 0
    let attempts3P = 0
    let makes3P = 0

    drillResults.forEach(result => {
      const spot = SPOTS.find(s => s.id === result.spotId)
      const is3P = spot?.is3pt ?? false

      totalAttempts += result.attempts
      totalMakes += result.makes

      if (is3P) {
        attempts3P += result.attempts
        makes3P += result.makes
      } else {
        attempts2P += result.attempts
        makes2P += result.makes
      }
    })

    // パーセンテージ計算
    const fgPercentage = totalAttempts > 0 ? (totalMakes / totalAttempts) * 100 : 0
    const fg2Percentage = attempts2P > 0 ? (makes2P / attempts2P) * 100 : 0
    const fg3Percentage = attempts3P > 0 ? (makes3P / attempts3P) * 100 : 0
    const efgPercentage = totalAttempts > 0 ? 
      ((makes2P + 1.5 * makes3P) / totalAttempts) * 100 : 0

    // ポイント計算
    const points = makes2P * 2 + makes3P * 3

    // 時間計算（分）
    const minutes = session.endedAt 
      ? Math.max(1, Math.floor((session.endedAt - session.startedAt) / 60000))
      : Math.max(1, Math.floor((Date.now() - session.startedAt) / 60000))

    // 日付フォーマット
    const date = new Date(session.startedAt).toISOString().split('T')[0]

    return {
      sessionId: session.id!,
      sessionTitle: session.note || 'Session',
      date,
      startedAt: session.startedAt,
      totalAttempts,
      totalMakes,
      fgPercentage,
      attempts2P,
      makes2P,
      fg2Percentage,
      attempts3P,
      makes3P,
      fg3Percentage,
      efgPercentage,
      points,
      minutes
    }
  })

  return Promise.all(statsPromises)
}

// スポット別統計データを取得
export async function getSpotStats(): Promise<SpotStats[]> {
  const allResults = await db.drillResults.toArray()
  
  // スポット別に集計
  const spotData = new Map<number, {
    totalAttempts: number
    totalMakes: number
    sessions: Set<number>
  }>()

  allResults.forEach(result => {
    const spotId = result.spotId
    if (!spotId) return

    const current = spotData.get(spotId) || {
      totalAttempts: 0,
      totalMakes: 0,
      sessions: new Set<number>()
    }

    current.totalAttempts += result.attempts
    current.totalMakes += result.makes
    current.sessions.add(result.sessionId)

    spotData.set(spotId, current)
  })

  // SPOTS情報と結合
  return SPOTS.map(spot => {
    const data = spotData.get(spot.id) || {
      totalAttempts: 0,
      totalMakes: 0,
      sessions: new Set<number>()
    }

    return {
      spotId: spot.id,
      spotLabel: spot.label,
      is3pt: spot.is3pt,
      x: spot.x,
      y: spot.y,
      totalAttempts: data.totalAttempts,
      totalMakes: data.totalMakes,
      fgPercentage: data.totalAttempts > 0 ? (data.totalMakes / data.totalAttempts) * 100 : 0,
      sessions: data.sessions.size
    }
  }).filter(spot => spot.totalAttempts > 0) // 実際に使用されたスポットのみ
}

// 時系列統計データを取得（日別集計）
export async function getTimeSeriesStats(): Promise<TimeSeriesData[]> {
  const sessionsStats = await getAllSessionsStats()
  
  // 日別にグループ化
  const dailyData = new Map<string, {
    totalAttempts: number
    totalMakes: number
    attempts2P: number
    makes2P: number
    attempts3P: number
    makes3P: number
    sessionCount: number
  }>()

  sessionsStats.forEach(session => {
    const current = dailyData.get(session.date) || {
      totalAttempts: 0,
      totalMakes: 0,
      attempts2P: 0,
      makes2P: 0,
      attempts3P: 0,
      makes3P: 0,
      sessionCount: 0
    }

    current.totalAttempts += session.totalAttempts
    current.totalMakes += session.totalMakes
    current.attempts2P += session.attempts2P
    current.makes2P += session.makes2P
    current.attempts3P += session.attempts3P
    current.makes3P += session.makes3P
    current.sessionCount += 1

    dailyData.set(session.date, current)
  })

  // 時系列データに変換
  return Array.from(dailyData.entries())
    .map(([date, data]) => ({
      date,
      fgPercentage: data.totalAttempts > 0 ? (data.totalMakes / data.totalAttempts) * 100 : 0,
      fg2Percentage: data.attempts2P > 0 ? (data.makes2P / data.attempts2P) * 100 : 0,
      fg3Percentage: data.attempts3P > 0 ? (data.makes3P / data.attempts3P) * 100 : 0,
      totalAttempts: data.totalAttempts,
      totalMakes: data.totalMakes,
      sessionCount: data.sessionCount
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// 累計統計データを取得
export async function getOverallStats(): Promise<OverallStats> {
  const sessionsStats = await getAllSessionsStats()
  
  if (sessionsStats.length === 0) {
    return {
      totalSessions: 0,
      totalMinutes: 0,
      totalAttempts: 0,
      totalMakes: 0,
      overallFgPercentage: 0,
      total2PAttempts: 0,
      total2PMakes: 0,
      overall2PPercentage: 0,
      total3PAttempts: 0,
      total3PMakes: 0,
      overall3PPercentage: 0,
      overallEfgPercentage: 0,
      totalPoints: 0,
      averageAttemptsPerSession: 0,
      averageMakesPerSession: 0,
      bestSession: null,
      recentTrend: 'stable'
    }
  }

  // 累計値計算
  const totals = sessionsStats.reduce((acc, session) => ({
    totalSessions: acc.totalSessions + 1,
    totalMinutes: acc.totalMinutes + session.minutes,
    totalAttempts: acc.totalAttempts + session.totalAttempts,
    totalMakes: acc.totalMakes + session.totalMakes,
    total2PAttempts: acc.total2PAttempts + session.attempts2P,
    total2PMakes: acc.total2PMakes + session.makes2P,
    total3PAttempts: acc.total3PAttempts + session.attempts3P,
    total3PMakes: acc.total3PMakes + session.makes3P,
    totalPoints: acc.totalPoints + session.points
  }), {
    totalSessions: 0,
    totalMinutes: 0,
    totalAttempts: 0,
    totalMakes: 0,
    total2PAttempts: 0,
    total2PMakes: 0,
    total3PAttempts: 0,
    total3PMakes: 0,
    totalPoints: 0
  })

  // パーセンテージ計算
  const overallFgPercentage = totals.totalAttempts > 0 ? 
    (totals.totalMakes / totals.totalAttempts) * 100 : 0
  const overall2PPercentage = totals.total2PAttempts > 0 ? 
    (totals.total2PMakes / totals.total2PAttempts) * 100 : 0
  const overall3PPercentage = totals.total3PAttempts > 0 ? 
    (totals.total3PMakes / totals.total3PAttempts) * 100 : 0
  const overallEfgPercentage = totals.totalAttempts > 0 ? 
    ((totals.total2PMakes + 1.5 * totals.total3PMakes) / totals.totalAttempts) * 100 : 0

  // 平均値計算
  const averageAttemptsPerSession = totals.totalSessions > 0 ? 
    totals.totalAttempts / totals.totalSessions : 0
  const averageMakesPerSession = totals.totalSessions > 0 ? 
    totals.totalMakes / totals.totalSessions : 0

  // ベストセッション検索
  const bestSession = sessionsStats.reduce((best, current) => {
    if (!best || current.fgPercentage > best.fgPercentage) {
      return {
        sessionId: current.sessionId,
        title: current.sessionTitle,
        fgPercentage: current.fgPercentage,
        date: current.date
      }
    }
    return best
  }, null as { sessionId: number; title: string; fgPercentage: number; date: string } | null)

  // 最近のトレンド分析（直近5セッション vs その前5セッション）
  let recentTrend: 'improving' | 'declining' | 'stable' = 'stable'
  if (sessionsStats.length >= 10) {
    const recent5 = sessionsStats.slice(0, 5)
    const previous5 = sessionsStats.slice(5, 10)
    
    const recentAvg = recent5.reduce((sum, s) => sum + s.fgPercentage, 0) / 5
    const previousAvg = previous5.reduce((sum, s) => sum + s.fgPercentage, 0) / 5
    
    const diff = recentAvg - previousAvg
    if (diff > 2) recentTrend = 'improving'
    else if (diff < -2) recentTrend = 'declining'
  }

  return {
    ...totals,
    overallFgPercentage,
    overall2PPercentage,
    overall3PPercentage,
    overallEfgPercentage,
    averageAttemptsPerSession,
    averageMakesPerSession,
    bestSession,
    recentTrend
  }
}

// 移動平均を計算するヘルパー関数
export function calculateMovingAverage(data: TimeSeriesData[], windowSize: number = 5): TimeSeriesData[] {
  if (data.length < windowSize) return data

  return data.map((item, index) => {
    if (index < windowSize - 1) return item

    const window = data.slice(index - windowSize + 1, index + 1)
    const avgFg = window.reduce((sum, d) => sum + d.fgPercentage, 0) / windowSize
    const avgFg2 = window.reduce((sum, d) => sum + d.fg2Percentage, 0) / windowSize
    const avgFg3 = window.reduce((sum, d) => sum + d.fg3Percentage, 0) / windowSize

    return {
      ...item,
      fgPercentage: avgFg,
      fg2Percentage: avgFg2,
      fg3Percentage: avgFg3
    }
  })
}