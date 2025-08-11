// src/components/HistoryScreen.tsx (V2版)
'use client'
import { useHorizontalSwipe } from '@/hooks/useHorizontalSwipe'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { listSessions, getSessionSummary, startSession, endSession } from '@/db/repositories'
import { updateSessionMode } from '@/db/repositories-v2'
import type { Session } from '@/db/dexie'

const fmtDate = (ts?: number) => {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`
}
const mins = (s:Session) => Math.max(1, Math.floor(((s.endedAt ?? Date.now()) - s.startedAt)/60000))

export default function HistoryScreenV2() {
  const router = useRouter()
  const [items, setItems] = useState<Array<Session & { att:number; mk:number; fg:number }>>([])
  useHorizontalSwipe({ threshold: 80, maxPull: 160, flingMs: 220 })
  
  const load = useCallback(async () => {
    const ss = await listSessions()
    const out: Array<Session & { att:number; mk:number; fg:number }> = []
    for (const s of ss) {
      const sum = await getSessionSummary(s.id!)
      out.push({
        ...s,
        att: sum.total.attempts,
        mk: sum.total.makes,
        fg: sum.total.attempts ? sum.total.makes / sum.total.attempts : 0
      })
    }
    
    // currentセッションを一番上に移動
    const sorted = out.sort((a, b) => {
      // currentセッション（endedAtがない）を優先
      if (!a.endedAt && b.endedAt) return -1
      if (a.endedAt && !b.endedAt) return 1
      // 両方とも同じ状態なら日時で降順ソート
      return b.startedAt - a.startedAt
    })
    
    setItems(sorted)
  }, [])

  useEffect(() => { void load() }, [load])

  async function onNewSession() {
    // 既存のアクティブセッションがあれば終了
    const latest = items.find(item => !item.endedAt)
    if (latest) {
      await endSession(latest.id!)
    }
    
    // セッション数を取得して新しいセッション名を生成
    const sessionCount = items.length
    const sessionTitle = `Session${sessionCount + 1}`
    
    const sessionId = await startSession(sessionTitle)
    // デフォルトは自由配置モード
    await updateSessionMode(sessionId, 'free')
    
    router.replace('/session')
  }

  function handleSessionClick(session: Session & { att:number; mk:number; fg:number }) {
    if (!session.endedAt) {
      router.push('/session')
    } else {
      // モード判別してResult画面を振り分け
      const mode = session.mode || 'free' // デフォルトは自由配置
      if (mode === 'spot') {
        router.push(`/result-spot/${session.id}`)
      } else {
        router.push(`/result/${session.id}`)
      }
    }
  }

  // モード判別のアイコンとラベル
  const getModeInfo = (mode?: string) => {
    if (mode === 'spot') {
      return { label: 'Spot', color: '#3b82f6' }
    } else {
      return { label: 'Free', color: '#10b981' }
    }
  }

  return (
    <main className="page-fit" style={{ padding: 0 }}>
      {/* タイトルヘッダー */}
      <div style={{
        padding:'16px 16px 12px 16px'
      }}>
        <div style={{ fontSize:24, fontWeight:800 }}>Play Histories</div>
      </div>

      {/* スクロール領域 */}
      <div className="fit-scroll" style={{ padding:'0 16px' }}>
        <ul>
          {items.map(s => {
            const modeInfo = getModeInfo(s.mode)
            return (
              <li key={s.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                <button
                  onClick={() => handleSessionClick(s)}
                  style={{ 
                    display:'block', 
                    padding: '12px 4px', 
                    color: 'inherit', 
                    textDecoration: 'none',
                    background: 'none',
                    border: 'none',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                    WebkitAppearance: 'none',
                    touchAction: 'manipulation'
                  }}
                >
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ fontSize: 20, fontWeight: 800 }}>{s.note || 'Session'}</div>
                        
                        {/* モード表示バッジ */}
                        <div style={{
                          padding: '2px 8px',
                          background: modeInfo.color,
                          color: '#fff',
                          borderRadius: 12,
                          fontSize: 10,
                          fontWeight: 600
                        }}>
                          {modeInfo.label}
                        </div>
                        
                        {!s.endedAt && (
                          <span style={{
                            fontSize: 11, fontWeight: 800,
                            color: '#fff', background:'#d22',
                            padding: '2px 6px', borderRadius: 999
                          }}>current</span>
                        )}
                      </div>
                      <div style={{ display:'flex', gap: 24, marginTop: 6 }}>
                        <SmallMetric label="MINS" value={String(mins(s))} />
                        <SmallMetric label="FG"   value={`${s.mk}/${s.att}`} />
                        <SmallMetric label="FG%"  value={(s.fg*100).toFixed(1)} />
                      </div>
                    </div>
                    <div style={{ fontSize: 22 }}>›</div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color:'#9aa' }}>{fmtDate(s.startedAt)}</div>
                </button>
              </li>
            )
          })}
          {items.length === 0 && (
            <li style={{ padding:'16px 4px', color:'#9aa' }}>履歴はありません</li>
          )}
        </ul>
      </div>
      <button
        onClick={onNewSession}
        style={{
          position: 'fixed',
          bottom: 60, // フッター分の高さを考慮
          right: 20,
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: '#0ea5e9',
          border: 'none',
          color: '#fff',
          fontSize: 24,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(14, 165, 233, 0.4)',
          zIndex: 10
        }}
      >
        +
      </button>
    </main>
  )
}

function SmallMetric({label, value}:{label:string; value:string}) {
  return (
    <div style={{ textAlign:'left' }}>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 11, color:'#9aa' }}>{label}</div>
    </div>
  )
}