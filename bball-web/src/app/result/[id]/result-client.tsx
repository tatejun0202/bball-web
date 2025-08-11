'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Court from '@/components/CourtImageSpots'
import { SPOTS } from '@/constants/spots'
import { getSession, getSessionSummary, getSessionSpotBreakdown } from '@/db/repositories'
import type { Session } from '@/db/dexie'
import { useEdgeSwipeToHistory } from '@/hooks/useEdgeSwipeToHistory'

const pct = (n: number) => (n * 100).toFixed(1)

export default function ResultClient({ sessionId }: { sessionId: number }) {
  useEdgeSwipeToHistory({ edgeStartRatio: 1/3, threshold: 80, maxPull: 160, flingMs: 220 })
  const [summaryTxt, setSummaryTxt] = useState('集計中…')
  const [spotStats, setSpotStats] = useState<Record<number, { att: number, mk: number, fg: number }>>({})
  const [activeId, setActiveId] = useState<number | undefined>()
  const [session, setSession] = useState<Session | null>(null)
  useEffect(() => { (async()=> setSession(await getSession(sessionId) ?? null))() }, [sessionId])



  useEffect(() => {
    (async () => {
      const s = await getSessionSummary(sessionId)
      setSummaryTxt(`試投:${s.total.attempts} 成功:${s.total.makes} FG:${pct(s.fg)}% 3FG:${pct(s.p3)}% eFG:${pct(s.efg)}%`)
      const rows = await getSessionSpotBreakdown(sessionId)
      const map: Record<number, { att: number, mk: number, fg: number }> = {}
      for (const r of rows) map[r.id] = { att: r.att, mk: r.mk, fg: r.fg }
      setSpotStats(map)
      setActiveId(rows.find(r => r.att > 0)?.id ?? SPOTS[0].id)
    })().catch(console.error)
  }, [sessionId])

  // Sessionの startedAt/endedAt を履歴から引いて来たい場合は repositories にAPIがあればそれを使う
  useEffect(() => {
    // 省略可：必要なら repositories に getSession(sessionId) を生やして読み込む
  }, [sessionId])

    const active = activeId ? SPOTS.find(s => s.id === activeId) : undefined
    // ★ 選択中スポットの集計だけ取り出す
    const stat = (activeId !== undefined && spotStats[activeId])
        ? spotStats[activeId]
        : { att: 0, mk: 0, fg: 0 }
    const att = stat.att
    const mk  = stat.mk
    const fgp = stat.fg * 100

  // メトリクス（レイアウト用の値）
  const metrics = useMemo(() => {
    // 分計算（endedAt が無ければ now）
    const mins = session ? Math.max(1, Math.floor(((session.endedAt ?? Date.now()) - session.startedAt) / 60000)) : undefined
    const fgAtt = Object.values(spotStats).reduce((a,v)=>a+v.att,0)
    const fgMk  = Object.values(spotStats).reduce((a,v)=>a+v.mk,0)
    return { mins, fgAtt, fgMk }
  }, [spotStats, session])

  
const dateLabel = useMemo(() => {
  if (!session?.startedAt) return ''
  const d = new Date(session.startedAt)
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`
}, [session])

  return (
    <main className = "page-fit" style={{ padding: 16 }}>
      {/* 日付 & コメント */}
      <div className = "fit-scroll" style={{ fontSize: 15, fontWeight: 400 }}>{dateLabel}</div>
      <div className = "fit-scroll" style={{ fontSize: 18, fontWeight: 700 }}>{session?.note ?? 'Session'}</div>
      <input placeholder="comment" style={{ marginTop: 8, width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #555', background: '#222', color: '#fff' }} />

      {/* メトリクス 3×2 */}
      <section style={{ marginTop: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {/* 1段目 */}
          <Metric big={metrics.mins ?? 0} label="MINS" />
          <Metric big={ (metrics.fgMk ?? 0) * 2 + (Object.entries(spotStats).reduce((a,[id,st]) => SPOTS.find(s=>s.id===Number(id))?.is3pt ? a+st.mk : a, 0) ) /*3P本数*/ } label="PTS" calcPts spotStats={spotStats}/>
          <Metric big={Number(pct((metrics.fgAtt ?? 0) ? (metrics.fgMk ?? 0)/(metrics.fgAtt ?? 0) : 0))} label="FG%" unit="%" />

          {/* 2段目 */}
          <Metric big={`${metrics.fgMk ?? 0}/${metrics.fgAtt ?? 0}`} label="FG" text />
          <Metric big={`${Object.values(spotStats).reduce((a,v,idx)=> SPOTS[idx]?.is3pt ? a+v.mk : a, 0)}/${Object.values(spotStats).reduce((a,v,idx)=> SPOTS[idx]?.is3pt ? a+v.att : a, 0)}`} label="3FG" text />
          <Metric big={Number(pct((() => {
            const att2 = Object.entries(spotStats).reduce((a,[id,v]) => (SPOTS.find(s=>s.id===Number(id))?.is3pt ? a : a+v.att), 0)
            const mk2  = Object.entries(spotStats).reduce((a,[id,v]) => (SPOTS.find(s=>s.id===Number(id))?.is3pt ? a : a+v.mk ), 0)
            const att3 = Object.entries(spotStats).reduce((a,[id,v]) => (SPOTS.find(s=>s.id===Number(id))?.is3pt ? a+v.att : a), 0)
            const mk3  = Object.entries(spotStats).reduce((a,[id,v]) => (SPOTS.find(s=>s.id===Number(id))?.is3pt ? a+v.mk  : a), 0)
            const den = att2 + att3
            return den ? (mk2 + 1.5*mk3)/den : 0
          })()))} label="eFG%" unit="%" />
        </div>
      </section>

      {/* Shot chart（上下反転ON） */}
      <h3 style={{ marginTop: 10, fontWeight: 700, textAlign: 'center', color: '#bbb' }}>Shot chart</h3>
      <Court width={360} activeId={activeId} onSelect={setActiveId} flipY />  {/* ★ここ反転 */}

      {/* 下部のスポットサマリ */}
      <div style={{ marginTop: 10, textAlign: 'center', color:'#bbb', fontSize:12 }}>
        {active?.label ?? '-'}
      </div>

      <div
        style={{
          marginTop: 6,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          alignItems: 'end',
          textAlign: 'center',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{att}</div>
          <div style={{ fontSize: 12, color: '#9aa', marginTop: 2 }}>Attempt</div>
        </div>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{mk}</div>
          <div style={{ fontSize: 12, color: '#9aa', marginTop: 2 }}>Made</div>
        </div>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{fgp.toFixed(1)}</div>
          <div style={{ fontSize: 12, color: '#9aa', marginTop: 2 }}>FG%</div>
        </div>
      </div>
    </main>
  )
}

function Metric({
  big, label, unit, text, calcPts, spotStats,
}: {
  big: number|string
  label: string
  unit?: string
  text?: boolean
  calcPts?: boolean
  spotStats?: Record<number,{att:number;mk:number;fg:number}>
}) {
  let show = big
  if (!text && typeof big === 'number' && unit === '%') show = (big).toFixed(1)
  if (calcPts && spotStats) {
    const mk3 = Object.entries(spotStats).reduce((a,[id,v]) => (SPOTS.find(s=>s.id===Number(id))?.is3pt ? a+v.mk : a), 0)
    const mk2 = Object.entries(spotStats).reduce((a,[id,v]) => (SPOTS.find(s=>s.id===Number(id))?.is3pt ? a : a+v.mk), 0)
    show = 2*mk2 + 3*mk3
  }
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 800 }}>{show}{unit ? '' : ''}</div>
      <div style={{ fontSize: 12, color: '#9aa' }}>{label}</div>
    </div>
  )
}
