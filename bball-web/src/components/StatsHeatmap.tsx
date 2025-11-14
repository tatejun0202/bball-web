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
  // 謌仙粥邇・〒繧ｽ繝ｼ繝医＠縺溘せ繝昴ャ繝・
  const sortedSpots = [...spotStats].sort((a, b) => b.fgPercentage - a.fgPercentage)
  
  // 繝帙ャ繝医せ繝昴ャ繝茨ｼ域・蜉溽紫縺悟ｹｳ蝮・ｻ･荳翫〒縲∝香蛻・↑隧ｦ謚墓焚縺後≠繧九せ繝昴ャ繝茨ｼ・
  const hotSpots = spotStats.filter(spot => 
    spot.fgPercentage >= overallStats.overallFgPercentage && 
    spot.totalAttempts >= 10
  )

  // 繧ｳ繝ｼ繝ｫ繝峨せ繝昴ャ繝茨ｼ域・蜉溽紫縺悟ｹｳ蝮・ｻ･荳具ｼ・
  const coldSpots = spotStats.filter(spot => 
    spot.fgPercentage < overallStats.overallFgPercentage && 
    spot.totalAttempts >= 5
  )

  // 繝偵・繝医・繝・・縺ｮ濶ｲ繧定ｨ育ｮ・
  const getHeatColor = (fgPercentage: number, attempts: number) => {
    if (attempts < 5) return 'rgba(156, 163, 175, 0.6)' // 繧ｰ繝ｬ繝ｼ・医ョ繝ｼ繧ｿ荳崎ｶｳ・・    const alpha = Math.min(attempts / 50, 1) * 0.8 + 0.2 // 隧ｦ謚墓焚縺ｫ蠢懊§縺滄乗・蠎ｦ
    
    if (fgPercentage >= 70) {
      // 邱醍ｳｻ・磯ｫ俶・蜉溽紫・・
      return `rgba(34, 197, 94, ${alpha})`
    } else if (fgPercentage >= 50) {
      // 鮟・ｳｻ・井ｸｭ遞句ｺｦ・・
      return `rgba(251, 191, 36, ${alpha})`
    } else if (fgPercentage >= 30) {
      // 繧ｪ繝ｬ繝ｳ繧ｸ邉ｻ・井ｽ弱ａ・・
      return `rgba(249, 115, 22, ${alpha})`
    } else {
      // 襍､邉ｻ・井ｽ取・蜉溽紫・・
      return `rgba(239, 68, 68, ${alpha})`
    }
  }

  // 繧ｵ繧､繧ｺ繧定ｨ育ｮ暦ｼ郁ｩｦ謚墓焚縺ｫ蝓ｺ縺･縺擾ｼ・
  const getSpotSize = (attempts: number) => {
    const baseSize = 20
    const sizeMultiplier = Math.min(attempts / 30, 2)
    return Math.max(baseSize, baseSize * sizeMultiplier)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* 繝偵・繝医・繝・・ */}
      <section>
        <SectionTitle>繝偵・繝医・繝・・</SectionTitle>
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
            {/* 繧ｳ繝ｼ繝育判蜒・*/}
            <Image
              src="/court.png"
              alt="court"
              fill
              priority
              sizes="(max-width: 430px) 100vw, 430px"
              style={{
                objectFit: 'contain',
                transform: 'scaleY(-1)', // 荳贋ｸ句渚霆｢
                pointerEvents: 'none'
              }}
            />

            {/* 繝偵・繝医・繝・・繝峨ャ繝・*/}
            {spotStats.map((spot) => {
              const size = getSpotSize(spot.totalAttempts)
              const color = getHeatColor(spot.fgPercentage, spot.totalAttempts)
              
              return (
                <div
                  key={spot.spotId}
                  style={{
                    position: 'absolute',
                    left: `${spot.x * 100}%`,
                    top: `${(1 - spot.y) * 100}%`, // Y蠎ｧ讓吶ｂ蜿崎ｻ｢
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

        {/* 蜃｡萓・*/}
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
          <LegendItem color="rgba(156, 163, 175, 0.6)" label="繝・・繧ｿ荳崎ｶｳ" />
        </div>
      </section>

      {/* 繝帙ャ繝医せ繝昴ャ繝・*/}
      {hotSpots.length > 0 && (
        <section>
          <SectionTitle>櫨 繝帙ャ繝医せ繝昴ャ繝・/SectionTitle>
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
            蟷ｳ蝮・・蜉溽紫・・overallStats.overallFgPercentage.toFixed(1)}%・我ｻ･荳翫〒10蝗樔ｻ･荳翫・隧ｦ謚輔′縺ゅｋ繧ｹ繝昴ャ繝・
          </div>
        </section>
      )}

      {/* 繧ｳ繝ｼ繝ｫ繝峨せ繝昴ャ繝・*/}
      {coldSpots.length > 0 && (
        <section>
          <SectionTitle>ｧ・謾ｹ蝟・・菴吝慍縺後≠繧九せ繝昴ャ繝・/SectionTitle>
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
            蟷ｳ蝮・・蜉溽紫莉･荳九・繧ｹ繝昴ャ繝医らｷｴ鄙偵ｒ驥阪・縺ｦ謾ｹ蝟・ｒ逶ｮ謖・＠縺ｾ縺励ｇ縺・
          </div>
        </section>
      )}

      {/* 蜈ｨ繧ｹ繝昴ャ繝郁ｩｳ邏ｰ */}
      <section>
        <SectionTitle>蜈ｨ繧ｹ繝昴ャ繝郁ｩｳ邏ｰ</SectionTitle>
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
                    {spot.totalMakes}/{spot.totalAttempts} 窶｢ {spot.sessions}繧ｻ繝・す繝ｧ繝ｳ
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
          {isHot ? '櫨' : 'ｧ・}
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
            {spot.totalMakes}/{spot.totalAttempts} 窶｢ {spot.sessions}繧ｻ繝・す繝ｧ繝ｳ
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
