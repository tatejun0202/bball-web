// src/components/StatsOverview.tsx
'use client'
import { type OverallStats, type SessionStats, type SpotStats } from '@/db/stats-repositories'

interface Props {
  overallStats: OverallStats
  sessionsStats: SessionStats[]
  spotStats: SpotStats[]
}

export default function StatsOverview({ overallStats, sessionsStats, spotStats }: Props) {
  // ベストスポット（成功率が高く、十分な試投数があるスポット）
  const bestSpots = spotStats
    .filter(spot => spot.totalAttempts >= 10) // 最低10回以上
    .sort((a, b) => b.fgPercentage - a.fgPercentage)
    .slice(0, 3)

  // 最近のセッション（直近5つ）
  const recentSessions = sessionsStats.slice(0, 5)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* 主要メトリクス */}
      <section>
        <SectionTitle>主要成績</SectionTitle>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: 12,
          marginBottom: 16
        }}>
          <MetricCard
            value={overallStats.overallFgPercentage.toFixed(1)}
            unit="%"
            label="総合FG%"
            large
            color="#0ea5e9"
          />
          <MetricCard
            value={overallStats.totalPoints.toString()}
            label="総得点"
            large
            color="#22c55e"
          />
        </div>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr 1fr', 
          gap: 12
        }}>
          <MetricCard
            value={overallStats.overall2PPercentage.toFixed(1)}
            unit="%"
            label="2P成功率"
            color="#f59e0b"
          />
          <MetricCard
            value={overallStats.overall3PPercentage.toFixed(1)}
            unit="%"
            label="3P成功率"
            color="#8b5cf6"
          />
          <MetricCard
            value={overallStats.overallEfgPercentage.toFixed(1)}
            unit="%"
            label="eFG%"
            color="#06b6d4"
          />
        </div>
      </section>

      {/* 練習量統計 */}
      <section>
        <SectionTitle>練習量</SectionTitle>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: 12,
          marginBottom: 16
        }}>
          <MetricCard
            value={(Math.round(overallStats.totalMinutes / 60 * 10) / 10).toString()}
            unit="時間"
            label="総練習時間"
            color="#ec4899"
          />
          <MetricCard
            value={overallStats.totalAttempts.toString()}
            label="総試投数"
            color="#10b981"
          />
        </div>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: 12
        }}>
          <MetricCard
            value={Math.round(overallStats.averageAttemptsPerSession).toString()}
            label="平均試投数/セッション"
            color="#6366f1"
          />
          <MetricCard
            value={Math.round(overallStats.averageMakesPerSession).toString()}
            label="平均成功数/セッション"
            color="#84cc16"
          />
        </div>
      </section>

      {/* ベストスポット */}
      {bestSpots.length > 0 && (
        <section>
          <SectionTitle>得意スポット TOP3</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bestSpots.map((spot, index) => (
              <div key={spot.spotId} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: '#252525',
                borderRadius: 8,
                border: index === 0 ? '1px solid #fbbf24' : '1px solid #374151'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: index === 0 ? '#fbbf24' : index === 1 ? '#9ca3af' : '#cd7c2f',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#000'
                  }}>
                    {index + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{spot.spotLabel}</div>
                    <div style={{ fontSize: 11, color: '#9aa' }}>
                      {spot.totalMakes}/{spot.totalAttempts} 
                      {spot.is3pt ? ' (3P)' : ' (2P)'}
                    </div>
                  </div>
                </div>
                <div style={{ 
                  fontSize: 18, 
                  fontWeight: 800,
                  color: index === 0 ? '#fbbf24' : '#ddd'
                }}>
                  {spot.fgPercentage.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ベストセッション */}
      {overallStats.bestSession && (
        <section>
          <SectionTitle>ベストセッション</SectionTitle>
          <div style={{
            padding: '16px',
            background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
            borderRadius: 12,
            border: '1px solid #3b82f6'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#dbeafe' }}>
                  {overallStats.bestSession.title}
                </div>
                <div style={{ fontSize: 12, color: '#bfdbfe', marginTop: 2 }}>
                  {overallStats.bestSession.date}
                </div>
              </div>
              <div style={{ 
                fontSize: 24, 
                fontWeight: 800,
                color: '#fff'
              }}>
                {overallStats.bestSession.fgPercentage.toFixed(1)}%
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 最近のセッション */}
      {recentSessions.length > 0 && (
        <section>
          <SectionTitle>最近のセッション</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentSessions.map((session, index) => (
              <div key={session.sessionId} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: index === 0 ? '#1e293b' : '#1f2937',
                borderRadius: 8,
                border: index === 0 ? '1px solid #0ea5e9' : '1px solid #374151'
              }}>
                <div>
                  <div style={{ 
                    fontSize: 14, 
                    fontWeight: 600,
                    color: index === 0 ? '#0ea5e9' : '#ddd'
                  }}>
                    {session.sessionTitle}
                  </div>
                  <div style={{ fontSize: 11, color: '#9aa', marginTop: 2 }}>
                    {session.date} • {session.totalMakes}/{session.totalAttempts} • {session.points}pts
                  </div>
                </div>
                <div style={{ 
                  fontSize: 16, 
                  fontWeight: 700,
                  color: index === 0 ? '#0ea5e9' : '#ddd'
                }}>
                  {session.fgPercentage.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: 16,
      fontWeight: 700,
      marginBottom: 12,
      color: '#ddd',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }}>
      {children}
    </h2>
  )
}

function MetricCard({ 
  value, 
  unit, 
  label, 
  large, 
  color = '#9aa' 
}: {
  value: string
  unit?: string
  label: string
  large?: boolean
  color?: string
}) {
  return (
    <div style={{
      padding: large ? '16px' : '12px',
      background: '#252525',
      borderRadius: 8,
      border: '1px solid #374151',
      textAlign: 'center'
    }}>
      <div style={{ 
        fontSize: large ? 28 : 20, 
        fontWeight: 800,
        color,
        lineHeight: 1
      }}>
        {value}{unit && <span style={{ fontSize: large ? 18 : 14 }}>{unit}</span>}
      </div>
      <div style={{ 
        fontSize: large ? 13 : 11, 
        color: '#9aa',
        marginTop: 4
      }}>
        {label}
      </div>
    </div>
  )
}