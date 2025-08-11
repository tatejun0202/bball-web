'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { listSessions, getSessionSummary, startSession, endSession } from '@/db/repositories'
import type { Session } from '@/db/dexie'

const fmtDate = (ts?: number) => {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`
}
const mins = (s:Session) => Math.max(1, Math.floor(((s.endedAt ?? Date.now()) - s.startedAt)/60000))

export default function HistoryScreen() {
  const router = useRouter()
  const [items, setItems] = useState<Array<Session & { att:number; mk:number; fg:number }>>([])

  useEffect(() => { load() }, [])
  async function load() {
    const ss = await listSessions()
    const out: typeof items = []
    for (const s of ss) {
      const sum = await getSessionSummary(s.id!)
      out.push({ ...s, att: sum.total.attempts, mk: sum.total.makes, fg: sum.total.attempts ? sum.total.makes/sum.total.attempts : 0 })
    }
    setItems(out)
  }

  async function onNewSession() {
    const latest = items[0]
    if (latest && !latest.endedAt) await endSession(latest.id!)
    await startSession('3Pシュート練習')
    router.replace('/session')
  }

  return (
    <main className="page-fit" style={{ padding: 0 }}>
      {/* sticky ヘッダー（いつも一番上） */}
      <div style={{
        position:'sticky', top:0, zIndex:1,
        background:'#1c1c1c', borderBottom:'1px solid #2a2a2a',
        padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center'
      }}>
        <div style={{ fontSize:18, fontWeight:800 }}>Play Histories</div>
        <button
          type="button"
          onClick={onNewSession}
          style={{ color:'#3aa8ff', background:'none', border:'none', cursor:'pointer', fontWeight:800 }}
        >
          New Session ▶
        </button>
      </div>

      {/* スクロール領域 */}
      <div className="fit-scroll" style={{ padding:'0 16px' }}>
        <ul>
          {items.map(s => {
            const href = !s.endedAt ? '/session' : (`/result/${s.id}` as any)
            return (
              <li key={s.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                <Link href={href} style={{ display:'block', padding: '12px 4px', color: 'inherit', textDecoration: 'none' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ fontSize: 20, fontWeight: 800 }}>{s.note || 'Session'}</div>
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
                </Link>
              </li>
            )
          })}
          {items.length === 0 && (
            <li style={{ padding:'16px 4px', color:'#9aa' }}>履歴はありません</li>
          )}
        </ul>
      </div>
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
