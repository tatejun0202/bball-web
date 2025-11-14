'use client'
import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { type OverallStats, type SessionStats, type SpotStats } from '@/db/stats-repositories'

type OverallStatsWithOptionalFt = OverallStats & {
  overallFtPercentage?: number
}

interface Props {
  overallStats: OverallStats
  sessionsStats: SessionStats[]
  spotStats: SpotStats[]
}

export default function StatsOverview({ overallStats, sessionsStats, spotStats }: Props) {
  const router = useRouter()
  const statsWithFt = overallStats as OverallStatsWithOptionalFt
  const ftPct =
    typeof statsWithFt.overallFtPercentage === 'number'
      ? statsWithFt.overallFtPercentage
      : undefined

  const averageStats = [
    { label: 'FG%', value: overallStats.overallFgPercentage.toFixed(1) },
    { label: '3FG%', value: overallStats.overall3PPercentage.toFixed(1) },
    { label: '2FG%', value: overallStats.overall2PPercentage.toFixed(1) },
    {
      label: 'FT%',
      value: ftPct !== undefined ? ftPct.toFixed(1) : '-',
    },
    { label: 'TS%', value: overallStats.overallEfgPercentage.toFixed(1) },
  ]

  const pointsPerSession =
    overallStats.totalSessions > 0 ? overallStats.totalPoints / overallStats.totalSessions : 0

  const totalStats = [
    { label: 'Points', value: overallStats.totalPoints.toLocaleString() },
    { label: 'Attempts', value: overallStats.totalAttempts.toLocaleString() },
    {
      label: 'Points/Session',
      value: pointsPerSession.toFixed(1),
    },
    { label: 'Attempts/Session', value: overallStats.averageAttemptsPerSession.toFixed(1) },
  ]

  // ベストパフォーマンスは得点/時間（効率）優先、同率ならFG%で比較
  const bestPerformanceSession = useMemo(() => {
    return (
      sessionsStats.reduce<{
        session: SessionStats
        pointsPerMinute: number
        fg: number
      } | null>((best, session) => {
        const minutes = Math.max(1, session.minutes)
        const pointsPerMinute = minutes > 0 ? session.points / minutes : 0
        const fg = session.fgPercentage

        if (!best) {
          return { session, pointsPerMinute, fg }
        }

        if (pointsPerMinute > best.pointsPerMinute) {
          return { session, pointsPerMinute, fg }
        }

        if (pointsPerMinute === best.pointsPerMinute && fg > best.fg) {
          return { session, pointsPerMinute, fg }
        }

        return best
      }, null)?.session ?? null
    )
  }, [sessionsStats])

  const fallbackSpot = useMemo(() => {
    return (
      spotStats
        .filter(spot => spot.totalAttempts >= 10)
        .sort((a, b) => b.fgPercentage - a.fgPercentage)[0] ?? null
    )
  }, [spotStats])

  const bestPerformanceDate = bestPerformanceSession?.date ?? null
  const bestPerformanceMetrics = bestPerformanceSession
    ? [
        { label: 'MINS', value: bestPerformanceSession.minutes.toString() },
        {
          label: 'FG',
          value: `${bestPerformanceSession.totalMakes}/${bestPerformanceSession.totalAttempts}`,
        },
        { label: 'FG%', value: bestPerformanceSession.fgPercentage.toFixed(1) },
      ]
    : [
        { label: 'SESSIONS', value: fallbackSpot ? fallbackSpot.sessions.toString() : '-' },
        {
          label: 'FG',
          value: fallbackSpot
            ? `${fallbackSpot.totalMakes}/${fallbackSpot.totalAttempts}`
            : '-',
        },
        { label: 'FG%', value: fallbackSpot ? fallbackSpot.fgPercentage.toFixed(1) : '-' },
      ]

  const handleBestPerformanceClick = () => {
    if (!bestPerformanceSession) return
    router.push(`/result/${bestPerformanceSession.sessionId}`)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
        paddingBottom: 24,
      }}
    >
      {/* ---------- Average ---------- */}
      <section>
        <SectionTitle>Average</SectionTitle>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 16,
            rowGap: 22,
          }}
        >
          {averageStats.map(stat => (
            <AverageItem key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>
      </section>

      {/* ---------- Total ---------- */}
      <section>
        <SectionTitle>Total</SectionTitle>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 18,
          }}
        >
          {totalStats.map(stat => (
            <TotalItem key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>
      </section>

      {/* ---------- Best Performance ---------- */}
      <section>
        <SectionTitle>Best Performance</SectionTitle>

        <button
          type="button"
          onClick={handleBestPerformanceClick}
          disabled={!bestPerformanceSession}
          style={{
            width: '100%',
            padding: '0 4px',
            background: 'none',
            border: 'none',
            color: 'inherit',
            textAlign: 'left',
            cursor: bestPerformanceSession ? 'pointer' : 'default',
            WebkitTapHighlightColor: 'transparent',
            WebkitAppearance: 'none',
            touchAction: 'manipulation',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  color: '#cfcfcf',
                  marginBottom: 4,
                }}
              >
                {bestPerformanceSession ? 'Session' : 'Spot'}
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                }}
              >
                {bestPerformanceSession?.sessionTitle ?? fallbackSpot?.spotLabel ?? '---'}
              </div>
            </div>
            <div style={{ fontSize: 26, color: '#b8b8b8' }}>›</div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 16,
            }}
          >
            {bestPerformanceMetrics.map(metric => (
              <BestMetric key={metric.label} value={metric.value} label={metric.label} />
            ))}
          </div>

          {bestPerformanceDate && (
            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                color: '#a0a0a0',
              }}
            >
              {bestPerformanceDate}
            </div>
          )}
        </button>
      </section>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: 18,
        fontWeight: 800,
        margin: 0,
        marginBottom: 12,
      }}
    >
      {children}
    </h2>
  )
}

function AverageItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: 12,
          color: '#9a9a9a',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 32,
          fontWeight: 800,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function TotalItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: 12,
          color: '#9a9a9a',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 32,
          fontWeight: 800,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function BestMetric({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div
        style={{
          fontSize: 32,
          fontWeight: 800,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          color: '#9a9a9a',
          marginTop: 4,
          letterSpacing: 1,
        }}
      >
        {label}
      </div>
    </div>
  )
}
