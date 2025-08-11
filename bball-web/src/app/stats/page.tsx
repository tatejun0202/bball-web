// src/app/stats/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useHorizontalSwipe } from '@/hooks/useHorizontalSwipe'
import { 
  getAllSessionsStats, 
  getOverallStats, 
  getTimeSeriesStats, 
  getSpotStats,
  type SessionStats,
  type OverallStats,
  type TimeSeriesData,
  type SpotStats
} from '@/db/stats-repositories'
import StatsOverview from '@/components/StatsOverview'
import StatsCharts from '@/components/StatsCharts'
import StatsHeatmap from '@/components/StatsHeatmap'

export default function StatsPage() {
  useHorizontalSwipe({ threshold: 80, maxPull: 160, flingMs: 220 })

  const [loading, setLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState<'overview' | 'trends' | 'heatmap'>('overview')
  
  // 統計データの状態
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null)
  const [sessionsStats, setSessionsStats] = useState<SessionStats[]>([])
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([])
  const [spotStats, setSpotStats] = useState<SpotStats[]>([])

  useEffect(() => {
    loadAllStats()
  }, [])

  const loadAllStats = async () => {
    try {
      setLoading(true)
      const [overall, sessions, timeSeries, spots] = await Promise.all([
        getOverallStats(),
        getAllSessionsStats(),
        getTimeSeriesStats(),
        getSpotStats()
      ])
      
      setOverallStats(overall)
      setSessionsStats(sessions)
      setTimeSeriesData(timeSeries)
      setSpotStats(spots)
    } catch (error) {
      console.error('統計データの読み込みエラー:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="page-fit" style={{ padding: 16 }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '60%',
          flexDirection: 'column',
          gap: 16
        }}>
          <div style={{ 
            width: 40, 
            height: 40, 
            border: '3px solid #333', 
            borderTop: '3px solid #0ea5e9',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <div style={{ color: '#9aa', fontSize: 14 }}>統計データを読み込み中...</div>
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </main>
    )
  }

  if (!overallStats || overallStats.totalSessions === 0) {
    return (
      <main className="page-fit" style={{ padding: 16 }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '60%',
          flexDirection: 'column',
          gap: 16,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#ddd' }}>統計データがありません</div>
          <div style={{ fontSize: 14, color: '#9aa', lineHeight: 1.5 }}>
            練習セッションを記録すると<br />
            統計情報が表示されます
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="page-fit">
      {/* タイトルヘッダー */}
      <div style={{ 
        padding: '16px 16px 12px 16px'
      }}>
        <h1 style={{ 
          fontSize: 24, 
          fontWeight: 800, 
          margin: 0,
          marginBottom: 8
        }}>Statistics</h1>
        <div style={{ 
          fontSize: 13, 
          color: '#9aa',
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <span>{overallStats.totalSessions} セッション</span>
          <span>•</span>
          <span>{Math.round(overallStats.totalMinutes / 60 * 10) / 10} 時間</span>
          <span>•</span>
          <span className={`trend-${overallStats.recentTrend}`}>
            {overallStats.recentTrend === 'improving' && '📈 上昇傾向'}
            {overallStats.recentTrend === 'declining' && '📉 下降傾向'}
            {overallStats.recentTrend === 'stable' && '➡️ 安定'}
          </span>
        </div>
      </div>

      {/* タブナビゲーション */}
      <div style={{ 
        display: 'flex',
        background: '#1a1a1a',
        marginBottom: 16
      }}>
        {[
          { key: 'overview', label: '概要', icon: '📊' },
          { key: 'trends', label: '推移', icon: '📈' },
          { key: 'heatmap', label: 'ヒート', icon: '🎯' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setSelectedTab(tab.key as 'overview' | 'trends' | 'heatmap')}
            style={{
              flex: 1,
              padding: '12px 8px',
              background: 'none',
              border: 'none',
              color: selectedTab === tab.key ? '#0ea5e9' : '#9aa',
              fontSize: 13,
              fontWeight: selectedTab === tab.key ? 700 : 500,
              cursor: 'pointer',
              borderBottom: selectedTab === tab.key ? '2px solid #0ea5e9' : '2px solid transparent',
              transition: 'all 0.2s ease',
              WebkitTapHighlightColor: 'transparent',
              WebkitAppearance: 'none',
              touchAction: 'manipulation'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </div>
          </button>
        ))}
      </div>

      {/* タブコンテンツ */}
      <div className="fit-scroll" style={{ 
        flex: 1,
        padding: 16,
        paddingBottom: 24
      }}>
        {selectedTab === 'overview' && (
          <StatsOverview 
            overallStats={overallStats}
            sessionsStats={sessionsStats}
            spotStats={spotStats}
          />
        )}
        
        {selectedTab === 'trends' && (
          <StatsCharts 
            timeSeriesData={timeSeriesData}
            sessionsStats={sessionsStats}
          />
        )}
        
        {selectedTab === 'heatmap' && (
          <StatsHeatmap 
            spotStats={spotStats}
            overallStats={overallStats}
          />
        )}
      </div>

      <style jsx>{`
        .trend-improving { color: #22c55e; }
        .trend-declining { color: #ef4444; }
        .trend-stable { color: #9aa; }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  )
}