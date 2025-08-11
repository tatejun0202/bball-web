// src/app/result/[id]/result-client.tsx (V2版)
'use client'
import { useEffect, useMemo, useState } from 'react'
import FreePositionCourt from '@/components/FreePositionCourt'
import { getSession } from '@/db/repositories'
import { getSessionSummaryV2, getSessionPositions } from '@/db/repositories-v2'
import { SPOTS } from '@/constants/spots'
import { detectArea, getAreaName } from '@/constants/court-areas'
import type { Session } from '@/db/dexie'
import type { PositionInfo } from '@/db/types'
import { useEdgeSwipeToHistory } from '@/hooks/useEdgeSwipeToHistory'

const pct = (n: number) => (n * 100).toFixed(1)

export default function ResultClientV2({ sessionId }: { sessionId: number }) {
  useEdgeSwipeToHistory({ edgeStartRatio: 1/3, threshold: 80, maxPull: 160, flingMs: 220 })
  
  const [session, setSession] = useState<Session | null>(null)
  const [positions, setPositions] = useState<PositionInfo[]>([])
  const [selectedPosition, setSelectedPosition] = useState<PositionInfo | null>(null)
  const [summary, setSummary] = useState<{
    total: { attempts: number; makes: number; percentage: number }
    fixed: { attempts: number; makes: number; percentage: number }
    free: { attempts: number; makes: number; percentage: number }
    twoPoint: { attempts: number; makes: number; percentage: number }
    threePoint: { attempts: number; makes: number; percentage: number }
    efgPercentage: number
  } | null>(null)

  // セッション基本情報の読み込み
  useEffect(() => { 
    (async () => setSession(await getSession(sessionId) ?? null))() 
  }, [sessionId])

  // 位置データ・統計情報の読み込み
  useEffect(() => {
    (async () => {
      const [sessionSummary, positionMap] = await Promise.all([
        getSessionSummaryV2(sessionId),
        getSessionPositions(sessionId)
      ])
      
      setSummary(sessionSummary)
      
      // 位置情報を PositionInfo[] 形式に変換
      const positionList: PositionInfo[] = []
      
      positionMap.forEach((data, key) => {
        if (key.startsWith('fixed:')) {
          // 固定スポット
          const spotId = parseInt(key.replace('fixed:', ''))
          const spot = SPOTS.find(s => s.id === spotId)
          if (spot) {
            positionList.push({
              type: 'fixed',
              spotId: spot.id,
              label: spot.label,
              is3pt: spot.is3pt,
              x: spot.x,
              y: spot.y,
              attempts: data.attempts,
              makes: data.makes,
              fgPercentage: data.attempts > 0 ? (data.makes / data.attempts) * 100 : 0
            })
          }
        } else if (key.startsWith('free:')) {
          // 自由配置
          const coords = key.replace('free:', '').split(',')
          const x = parseFloat(coords[0])
          const y = parseFloat(coords[1])
          
          positionList.push({
            type: 'free',
            x,
            y,
            attempts: data.attempts,
            makes: data.makes,
            fgPercentage: data.attempts > 0 ? (data.makes / data.attempts) * 100 : 0
          })
        }
      })
      
      setPositions(positionList)
    })()
  }, [sessionId])

  const handlePositionSelect = (position: PositionInfo) => {
    setSelectedPosition(position)
  }

  // 日付フォーマット
  const dateLabel = useMemo(() => {
    if (!session?.startedAt) return ''
    const d = new Date(session.startedAt)
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`
  }, [session])

  // 時間計算
  const minutes = useMemo(() => {
    if (!session) return 0
    return Math.max(1, Math.floor(((session.endedAt ?? Date.now()) - session.startedAt) / 60000))
  }, [session])

  // ポイント計算
  const points = useMemo(() => {
    if (!summary) return 0
    return summary.twoPoint.makes * 2 + summary.threePoint.makes * 3
  }, [summary])

  if (!session || !summary) {
    return (
      <main className="page-fit" style={{ padding: 16 }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '60%',
          color: '#9aa' 
        }}>
          読み込み中...
        </div>
      </main>
    )
  }

  return (
    <main className="page-fit" style={{ padding: 16, paddingBottom: 80 }}>
      {/* 日付 & タイトル */}
      <div style={{ fontSize: 15, fontWeight: 400, color: '#9aa' }}>{dateLabel}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
        {session.note || 'Session'}
      </div>
      
      {/* コメント入力 */}
      <input 
        placeholder="comment" 
        style={{ 
          marginBottom: 12, width: '100%', padding: '8px 10px', 
          borderRadius: 4, border: '1px solid #555', 
          background: '#222', color: '#fff',
          boxSizing: 'border-box'
        }} 
      />

      {/* メトリクス 3×2 */}
      <section style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {/* 1段目 */}
          <Metric value={minutes} label="MINS" />
          <Metric value={points} label="PTS" />
          <Metric value={summary.total.percentage.toFixed(1)} label="FG%" unit="%" />

          {/* 2段目 */}
          <Metric 
            value={`${summary.total.makes}/${summary.total.attempts}`} 
            label="FG" 
            text 
          />
          <Metric 
            value={`${summary.threePoint.makes}/${summary.threePoint.attempts}`} 
            label="3FG" 
            text 
          />
          <Metric 
            value={summary.efgPercentage.toFixed(1)} 
            label="eFG%" 
            unit="%" 
          />
        </div>
      </section>

      {/* 記録方式の統計 */}
      {(summary.fixed.attempts > 0 || summary.free.attempts > 0) && (
        <section style={{ marginBottom: 16 }}>
          <h4 style={{ 
            fontSize: 14, 
            fontWeight: 600, 
            color: '#ddd', 
            marginBottom: 8 
          }}>
            記録方式別
          </h4>
          <div style={{ 
            display: 'flex', 
            gap: 8, 
            fontSize: 11,
            color: '#9aa',
            flexWrap: 'wrap'
          }}>
            {summary.fixed.attempts > 0 && (
              <div style={{ 
                padding: '4px 8px', 
                background: '#1f2937', 
                borderRadius: 4,
                border: '1px solid #374151',
                flex: '1 1 auto',
                minWidth: 0
              }}>
                <span>📍 固定: </span>
                <span style={{ color: '#ddd', fontWeight: 600 }}>
                  {summary.fixed.makes}/{summary.fixed.attempts} 
                  ({summary.fixed.percentage.toFixed(1)}%)
                </span>
              </div>
            )}
            {summary.free.attempts > 0 && (
              <div style={{ 
                padding: '4px 8px', 
                background: '#1f2937', 
                borderRadius: 4,
                border: '1px solid #374151',
                flex: '1 1 auto',
                minWidth: 0
              }}>
                <span>🎯 自由: </span>
                <span style={{ color: '#ddd', fontWeight: 600 }}>
                  {summary.free.makes}/{summary.free.attempts} 
                  ({summary.free.percentage.toFixed(1)}%)
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Shot chart */}
      <h3 style={{ 
        marginBottom: 12, 
        fontWeight: 700, 
        textAlign: 'center', 
        color: '#bbb' 
      }}>
        Shot chart
      </h3>
      
      <FreePositionCourt
        width={Math.min(340, window.innerWidth - 32)}
        mode="display"
        positions={positions}
        selectedPosition={selectedPosition}
        onPositionSelect={handlePositionSelect}
        flipY={true}
        showFixedSpots={false}
      />

      {/* 選択中位置の詳細 */}
      {selectedPosition && (
        <div style={{
          marginTop: 16,
          padding: '12px 16px',
          background: '#1f2937',
          borderRadius: 8,
          border: '1px solid #374151'
        }}>
          <div style={{ 
            fontSize: 14, 
            fontWeight: 600, 
            color: '#ddd',
            marginBottom: 8
          }}>
            {selectedPosition.type === 'fixed' 
              ? selectedPosition.label 
              : getAreaName(selectedPosition.x, selectedPosition.y)
            }
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 12,
            textAlign: 'center'
          }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#ddd' }}>
                {selectedPosition.attempts}
              </div>
              <div style={{ fontSize: 10, color: '#9aa' }}>Attempt</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#ddd' }}>
                {selectedPosition.makes}
              </div>
              <div style={{ fontSize: 10, color: '#9aa' }}>Made</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#ddd' }}>
                {selectedPosition.fgPercentage.toFixed(1)}%
              </div>
              <div style={{ fontSize: 10, color: '#9aa' }}>FG%</div>
            </div>
          </div>

          {/* エリア情報 */}
          {selectedPosition.type === 'free' && (
            <div style={{ 
              marginTop: 6, 
              fontSize: 10, 
              color: '#9aa',
              textAlign: 'center'
            }}>
              座標: ({(selectedPosition.x * 100).toFixed(1)}, {(selectedPosition.y * 100).toFixed(1)})
            </div>
          )}
        </div>
      )}

      {/* 統計サマリー */}
      <div style={{
        marginTop: 16,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12
      }}>
        <div style={{
          padding: '12px',
          background: '#252525',
          borderRadius: 8,
          border: '1px solid #374151',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#22c55e' }}>
            {positions.length}
          </div>
          <div style={{ fontSize: 11, color: '#9aa' }}>
            シュート位置
          </div>
        </div>
        
        <div style={{
          padding: '12px',
          background: '#252525',
          borderRadius: 8,
          border: '1px solid #374151',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#3b82f6' }}>
            {positions.filter(p => p.fgPercentage >= 50).length}
          </div>
          <div style={{ fontSize: 11, color: '#9aa' }}>
            50%以上の位置
          </div>
        </div>
      </div>
    </main>
  )
}

function Metric({
  value, 
  label, 
  unit, 
  text 
}: {
  value: number | string
  label: string
  unit?: string
  text?: boolean
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#ddd' }}>
        {value}{unit && !text ? unit : ''}
      </div>
      <div style={{ fontSize: 11, color: '#9aa' }}>{label}</div>
    </div>
  )
}