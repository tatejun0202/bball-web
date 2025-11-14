'use client'
import Image from 'next/image'
import { type SpotStats, type OverallStats } from '@/db/stats-repositories'

interface Props {
  spotStats: SpotStats[]
  overallStats: OverallStats
}

const COURT_RATIO = 1095 / 768

export default function StatsHeatmap({ spotStats, overallStats }: Props) {
  const sortedSpots = [...spotStats].sort((a, b) => b.fgPercentage - a.fgPercentage)

  const hotSpots = spotStats.filter(
    spot => spot.totalAttempts >= 10 && spot.fgPercentage >= overallStats.overallFgPercentage
  )

  const coldSpots = spotStats.filter(
    spot => spot.totalAttempts >= 5 && spot.fgPercentage < overallStats.overallFgPercentage
  )

  const getHeatColor = (fgPct: number, attempts: number) => {
    if (attempts < 5) {
      return 'rgba(156, 163, 175, 0.6)'
    }

    const alpha = Math.min(attempts / 50, 1) * 0.8 + 0.2

    if (fgPct >= 70) return `rgba(34, 197, 94, ${alpha})`
    if (fgPct >= 50) return `rgba(251, 191, 36, ${alpha})`
    if (fgPct >= 30) return `rgba(249, 115, 22, ${alpha})`
    return `rgba(239, 68, 68, ${alpha})`
  }

  const getSpotSize = (attempts: number) => {
    const baseSize = 20
    const sizeMultiplier = Math.min(attempts / 30, 2)
    return Math.max(baseSize, baseSize * sizeMultiplier)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section>
        <SectionTitle>Heatmap</SectionTitle>
        <div style={{ width: 340, margin: '0 auto', marginBottom: 16 }}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: COURT_RATIO,
              overflow: 'hidden',
              border: '1px solid #374151',
              borderRadius: 8,
              background: '#1a1a1a',
            }}
          >
            <Image
              src="/court.png"
              alt="court"
              fill
              priority
              sizes="(max-width: 430px) 100vw, 430px"
              style={{ objectFit: 'contain', transform: 'scaleY(-1)', pointerEvents: 'none' }}
            />

            {spotStats.map(spot => {
              const size = getSpotSize(spot.totalAttempts)
              const color = getHeatColor(spot.fgPercentage, spot.totalAttempts)

              return (
                <div
                  key={spot.spotId}
                  style={{
                    position: 'absolute',
                    left: `${spot.x * 100}%`,
                    top: `${(1 - spot.y) * 100}%`,
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
                    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
                  }}
                >
                  {spot.fgPercentage.toFixed(0)}%
                </div>
              )
            })}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
            fontSize: 12,
            color: '#ddd',
            flexWrap: 'wrap',
          }}
        >
          <LegendItem color="rgba(34, 197, 94, 0.9)" label="70%+" />
          <LegendItem color="rgba(251, 191, 36, 0.9)" label="50%+" />
          <LegendItem color="rgba(249, 115, 22, 0.9)" label="30%+" />
          <LegendItem color="rgba(239, 68, 68, 0.9)" label="< 30%" />
        </div>
      </section>

      <section>
        <SectionTitle>Hot Spots</SectionTitle>
        {hotSpots.length === 0 ? (
          <div style={{ fontSize: 13, color: '#aaa' }}>No high-efficiency spots yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {hotSpots.slice(0, 3).map(spot => (
              <SpotCard key={spot.spotId} spot={spot} type="hot" />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Cold Spots</SectionTitle>
        {coldSpots.length === 0 ? (
          <div style={{ fontSize: 13, color: '#aaa' }}>Not enough data yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {coldSpots.slice(0, 3).map(spot => (
              <SpotCard key={spot.spotId} spot={spot} type="cold" />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Spot Rankings</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sortedSpots.map((spot, index) => (
            <div
              key={`rank-${spot.spotId}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                padding: '12px 16px',
                borderRadius: 10,
                background: '#101010',
                border: '1px solid #1f1f1f',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: getHeatColor(spot.fgPercentage, spot.totalAttempts),
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', gap: 6 }}>
                    <span>{index + 1}.</span>
                    <span>{spot.spotLabel}</span>
                    {spot.is3pt && (
                      <span
                        style={{
                          fontSize: 10,
                          background: '#8b5cf6',
                          color: '#fff',
                          padding: '2px 4px',
                          borderRadius: 3,
                        }}
                      >
                        3P
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#9aa' }}>
                    {spot.totalMakes}/{spot.totalAttempts} | {spot.sessions} sessions
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{spot.fgPercentage.toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: 16,
        fontWeight: 700,
        marginBottom: 12,
        color: '#ddd',
      }}
    >
      {children}
    </h2>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: color,
          border: '1px solid rgba(255, 255, 255, 0.3)',
        }}
      />
      <span>{label}</span>
    </div>
  )
}

function SpotCard({ spot, type }: { spot: SpotStats; type: 'hot' | 'cold' }) {
  const isHot = type === 'hot'
  const gradient = isHot
    ? 'linear-gradient(135deg, #059669, #10b981)'
    : 'linear-gradient(135deg, #dc2626, #ef4444)'
  const border = isHot ? '#10b981' : '#ef4444'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderRadius: 10,
        background: gradient,
        border: `1px solid ${border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          {isHot ? 'HOT' : 'COLD'}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', display: 'flex', gap: 6 }}>
            <span>{spot.spotLabel}</span>
            {spot.is3pt && (
              <span
                style={{
                  fontSize: 10,
                  background: 'rgba(255, 255, 255, 0.25)',
                  color: '#fff',
                  padding: '2px 4px',
                  borderRadius: 3,
                }}
              >
                3P
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.85)' }}>
            {spot.totalMakes}/{spot.totalAttempts} | {spot.sessions} sessions
          </div>
        </div>
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
        {spot.fgPercentage.toFixed(1)}%
      </div>
    </div>
  )
}
