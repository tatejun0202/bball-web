// src/components/StatsHeatmap.tsx
'use client'
import Image from 'next/image'
import { type SpotStats, type OverallStats } from '@/db/stats-repositories'

interface Props {
  spotStats: SpotStats[]
  overallStats: OverallStats
}

const COURT_RATIO = 1095 / 768

export default function StatsHeatmap({ spotStats, overallStats }: Props) {
  // 成功率でソートしたスポット
  const sortedSpots = [...spotStats].sort((a, b) => b.fgPercentage - a.fgPercentage)
  
  // ホットスポット（成功率が平均以上で、十分な試投数があるスポット）
  const hotSpots = spotStats.filter(spot => 
    spot.fgPercentage >= overallStats.overallFgPercentage && 
    spot.totalAttempts >= 10
  )

  // コールドスポット（成功率が平均以下）
  const coldSpots = spotStats.filter(spot => 
    spot.fgPercentage < overallStats.overallFgPercentage && 
    spot.totalAttempts >= 5
  )

  // ヒートマップの色を計算
  const getHeatColor = (fgPercentage: number, attempts: number) => {
    if (attempts < 5) return 'rgba(156, 163, 175, 0.6)' // グレー（データ不足）
    
    // const intensity = Math.min(fgPercentage / 100, 1)
    const alpha = Math.min(attempts / 50, 1) * 0.8 + 0.2 // 試投数に応じた透明度
    
    if (fgPercentage >= 70) {
      // 緑系（高成功率）
      return `rgba(34, 197, 94, ${alpha})`
    } else if (fgPercentage >= 50) {
      // 黄系（中程度）
      return `rgba(251, 191, 36, ${alpha})`
    } else if (fgPercentage >= 30) {
      // オレンジ系（低め）
      return `rgba(249, 115, 22, ${alpha})`
    } else {
      // 赤系（低成功率）
      return `rgba(239, 68, 68, ${alpha})`
    }
  }

  // サイズを計算（試投数に基づく）
  const getSpotSize = (attempts: number) => {
    const baseSize = 20
    // const maxSize = 40
    const sizeMultiplier = Math.min(attempts / 30, 2)
    return Math.max(baseSize, baseSize * sizeMultiplier)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ヒートマップ */}
      <section>
        <SectionTitle>ヒートマップ</SectionTitle>
        <div style={{ width: 340, margin: '0 auto', marginBottom: 16 }}>
          <div style={{
            position: 'relative',
            width: '100%',
            aspectRatio: COURT_RATIO,
            overflow: 'hidden',
            border: '1px solid #374151',
            borderRadius: 8,
            background: '#1a1a1a'
          }}>
            {/* コート画像 */}
            <Image
              src="/court.png"
              alt="court"
              fill
              priority
              sizes="(max-width: 430px) 100vw, 430px"
              style={{
                objectFit: 'contain',
                transform: 'scaleY(-1)', // 上下反転
                pointerEvents: 'none'
              }}
            />

            {/* ヒートマップドット */}
            {spotStats.map((spot) => {
              const size = getSpotSize(spot.totalAttempts)
              const color = getHeatColor(spot.fgPercentage, spot.totalAttempts)
              
              return (
                <div
                  key={spot.spotId}
                  style={{
                    position: 'absolute',
                    left: `${spot.x * 100}%`,
                    top: `${(1 - spot.y) * 100}%`, // Y座標も反転
                    transform: 'translate(-50%, -50%)',
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    background: color,
                    border: '2px solid rgba(255, 255, 255, 0.8)',
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#fff',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                  }}
                >
                  {spot.fgPercentage.toFixed(0)}%
                </div>
              )
            })}
          </div>
        </div>

        {/* 凡例 */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: 16,
          flexWrap: 'wrap',
          fontSize: 11,
          color: '#9aa'
        }}>
          <LegendItem color="rgba(34, 197, 94, 0.8)" label="70%+" />
          <LegendItem color="rgba(251, 191, 36, 0.8)" label="50-69%" />
          <LegendItem color="rgba(249, 115, 22, 0.8)" label="30-49%" />
          <LegendItem color="rgba(239, 68, 68, 0.8)" label="~29%" />
          <LegendItem color="rgba(156, 163, 175, 0.6)" label="データ不足" />
        </div>
      </section>

      {/* ホットスポット */}
      {hotSpots.length > 0 && (
        <section>
          <SectionTitle>🔥 ホットスポット</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {hotSpots.map((spot) => (
              <SpotCard 
                key={spot.spotId}
                spot={spot}
                type="hot"
              />
            ))}
          </div>
          <div style={{ 
            fontSize: 12, 
            color: '#9aa', 
            marginTop: 8,
            textAlign: 'center'
          }}>
            平均成功率（{overallStats.overallFgPercentage.toFixed(1)}%）以上で10回以上の試投があるスポット
          </div>
        </section>
      )}

      {/* コールドスポット */}
      {coldSpots.length > 0 && (
        <section>
          <SectionTitle>🧊 改善の余地があるスポット</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {coldSpots.map((spot) => (
              <SpotCard 
                key={spot.spotId}
                spot={spot}
                type="cold"
              />
            ))}
          </div>
          <div style={{ 
            fontSize: 12, 
            color: '#9aa', 
            marginTop: 8,
            textAlign: 'center'
          }}>
            平均成功率以下のスポット。練習を重ねて改善を目指しましょう
          </div>
        </section>
      )}

      {/* 全スポット詳細 */}
      <section>
        <SectionTitle>全スポット詳細</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sortedSpots.map((spot, index) => (
            <div key={spot.spotId} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              background: '#252525',
              borderRadius: 6,
              border: '1px solid #374151'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: getHeatColor(spot.fgPercentage, spot.totalAttempts),
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  flexShrink: 0
                }} />
                <div>
                  <div style={{ 
                    fontSize: 13, 
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    {spot.spotLabel}
                    {spot.is3pt && <span style={{ 
                      fontSize: 9, 
                      background: '#8b5cf6', 
                      color: '#fff', 
                      padding: '2px 4px', 
                      borderRadius: 3 
                    }}>3P</span>}
                  </div>
                  <div style={{ fontSize: 10, color: '#9aa' }}>
                    {spot.totalMakes}/{spot.totalAttempts} • {spot.sessions}セッション
                  </div>
                </div>
              </div>
              <div style={{ 
                fontSize: 15, 
                fontWeight: 700,
                color: index < 3 ? '#22c55e' : '#ddd'
              }}>
                {spot.fgPercentage.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: 16,
      fontWeight: 700,
      marginBottom: 12,
      color: '#ddd'
    }}>
      {children}
    </h2>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: color,
        border: '1px solid rgba(255, 255, 255, 0.3)'
      }} />
      <span>{label}</span>
    </div>
  )
}

function SpotCard({ 
  spot, 
  type 
}: { 
  spot: SpotStats
  type: 'hot' | 'cold'
}) {
  const isHot = type === 'hot'
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      background: isHot 
        ? 'linear-gradient(135deg, #059669, #10b981)' 
        : 'linear-gradient(135deg, #dc2626, #ef4444)',
      borderRadius: 8,
      border: `1px solid ${isHot ? '#10b981' : '#ef4444'}`
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 20 }}>
          {isHot ? '🔥' : '🧊'}
        </div>
        <div>
          <div style={{ 
            fontSize: 14, 
            fontWeight: 600, 
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            {spot.spotLabel}
            {spot.is3pt && <span style={{ 
              fontSize: 9, 
              background: 'rgba(255, 255, 255, 0.2)', 
              color: '#fff', 
              padding: '2px 4px', 
              borderRadius: 3 
            }}>3P</span>}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.8)' }}>
            {spot.totalMakes}/{spot.totalAttempts} • {spot.sessions}セッション
          </div>
        </div>
      </div>
      <div style={{ 
        fontSize: 18, 
        fontWeight: 800,
        color: '#fff'
      }}>
        {spot.fgPercentage.toFixed(1)}%
      </div>
    </div>
  )
}