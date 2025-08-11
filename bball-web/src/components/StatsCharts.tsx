// src/components/StatsCharts.tsx
'use client'
import { 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts'
import { type TimeSeriesData, type SessionStats, calculateMovingAverage } from '@/db/stats-repositories'

interface Props {
  timeSeriesData: TimeSeriesData[]
  sessionsStats: SessionStats[]
}

export default function StatsCharts({ timeSeriesData, sessionsStats }: Props) {
  // 移動平均データ（5日間）
  const smoothedData = calculateMovingAverage(timeSeriesData, 5)

  // セッション別データ（直近20セッション）
  const recentSessions = sessionsStats.slice(0, 20).reverse()

  // カスタムツールチップ
  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean
    payload?: Array<{
      color: string
      name: string
      value: number | string
    }>
    label?: string
  }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: '#1f2937',
          padding: '12px',
          borderRadius: 8,
          border: '1px solid #374151',
          fontSize: 12
        }}>
          <p style={{ color: '#ddd', margin: 0, marginBottom: 8 }}>{label}</p>
          {payload.map((entry, index: number) => (
            <p key={index} style={{ 
              color: entry.color, 
              margin: 0,
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12
            }}>
              <span>{entry.name}:</span>
              <span style={{ fontWeight: 700 }}>
                {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
                {entry.name.includes('%') ? '%' : ''}
              </span>
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      
      {/* 成功率推移（時系列） */}
      <section>
        <ChartTitle>成功率の推移</ChartTitle>
        <div style={{ 
          height: 280, 
          background: '#1a1a1a', 
          borderRadius: 8, 
          padding: 16,
          border: '1px solid #2a2a2a'
        }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={smoothedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis 
                dataKey="date" 
                stroke="#9aa"
                fontSize={10}
                tickFormatter={(value) => new Date(value).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
              />
              <YAxis 
                stroke="#9aa"
                fontSize={10}
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '12px' }}
                iconType="line"
              />
              <Line 
                type="monotone" 
                dataKey="fgPercentage" 
                stroke="#0ea5e9" 
                strokeWidth={3}
                dot={{ fill: '#0ea5e9', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#0ea5e9', strokeWidth: 2 }}
                name="FG%"
              />
              <Line 
                type="monotone" 
                dataKey="fg2Percentage" 
                stroke="#f59e0b" 
                strokeWidth={2}
                dot={{ fill: '#f59e0b', strokeWidth: 1, r: 3 }}
                name="2P%"
              />
              <Line 
                type="monotone" 
                dataKey="fg3Percentage" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                dot={{ fill: '#8b5cf6', strokeWidth: 1, r: 3 }}
                name="3P%"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <ChartNote>
          ※ 5日間の移動平均で表示。日別の変動を滑らかにしています。
        </ChartNote>
      </section>

      {/* 試投数推移 */}
      <section>
        <ChartTitle>練習量の推移</ChartTitle>
        <div style={{ 
          height: 240, 
          background: '#1a1a1a', 
          borderRadius: 8, 
          padding: 16,
          border: '1px solid #2a2a2a'
        }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis 
                dataKey="date" 
                stroke="#9aa"
                fontSize={10}
                tickFormatter={(value) => new Date(value).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
              />
              <YAxis 
                stroke="#9aa"
                fontSize={10}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '12px' }}
              />
              <Bar 
                dataKey="totalAttempts" 
                fill="#22c55e" 
                name="試投数"
                radius={[2, 2, 0, 0]}
              />
              <Bar 
                dataKey="sessionCount" 
                fill="#06b6d4" 
                name="セッション数"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* セッション別成績（直近20回） */}
      <section>
        <ChartTitle>最近のセッション成績</ChartTitle>
        <div style={{ 
          height: 260, 
          background: '#1a1a1a', 
          borderRadius: 8, 
          padding: 16,
          border: '1px solid #2a2a2a'
        }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={recentSessions}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis 
                dataKey="sessionTitle" 
                stroke="#9aa"
                fontSize={9}
                angle={-45}
                textAnchor="end"
                height={60}
                interval={0}
              />
              <YAxis 
                stroke="#9aa"
                fontSize={10}
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '12px' }}
              />
              <Bar 
                dataKey="fgPercentage" 
                fill="#0ea5e9" 
                name="FG%"
                radius={[2, 2, 0, 0]}
              />
              <Bar 
                dataKey="fg3Percentage" 
                fill="#8b5cf6" 
                name="3P%"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ChartNote>
          ※ 直近20セッションの成績。古い順（左）から新しい順（右）に表示。
        </ChartNote>
      </section>

      {/* 時間帯別成績（将来の機能として準備） */}
      <section>
        <ChartTitle>統計サマリー</ChartTitle>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: 16 
        }}>
          <StatCard
            title="最高記録"
            items={[
              { 
                label: '単日最高FG%', 
                value: Math.max(...timeSeriesData.map(d => d.fgPercentage)).toFixed(1) + '%',
                color: '#22c55e'
              },
              { 
                label: '単日最多試投', 
                value: Math.max(...timeSeriesData.map(d => d.totalAttempts)).toString() + '本',
                color: '#f59e0b'
              }
            ]}
          />
          <StatCard
            title="平均値"
            items={[
              { 
                label: '日別平均FG%', 
                value: (timeSeriesData.reduce((sum, d) => sum + d.fgPercentage, 0) / timeSeriesData.length || 0).toFixed(1) + '%',
                color: '#0ea5e9'
              },
              { 
                label: '日別平均試投', 
                value: Math.round(timeSeriesData.reduce((sum, d) => sum + d.totalAttempts, 0) / timeSeriesData.length || 0).toString() + '本',
                color: '#8b5cf6'
              }
            ]}
          />
        </div>
      </section>

    </div>
  )
}

function ChartTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: 16,
      fontWeight: 700,
      marginBottom: 12,
      color: '#ddd'
    }}>
      {children}
    </h3>
  )
}

function ChartNote({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 11,
      color: '#9aa',
      marginTop: 8,
      marginBottom: 0,
      textAlign: 'center'
    }}>
      {children}
    </p>
  )
}

function StatCard({ 
  title, 
  items 
}: { 
  title: string
  items: Array<{ label: string; value: string; color: string }>
}) {
  return (
    <div style={{
      padding: 16,
      background: '#252525',
      borderRadius: 8,
      border: '1px solid #374151'
    }}>
      <h4 style={{
        fontSize: 14,
        fontWeight: 600,
        color: '#ddd',
        margin: 0,
        marginBottom: 12
      }}>
        {title}
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, index) => (
          <div key={index} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: 12, color: '#9aa' }}>{item.label}</span>
            <span style={{ 
              fontSize: 14, 
              fontWeight: 700, 
              color: item.color 
            }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}