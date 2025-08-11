'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Court from '@/components/CourtImageSpots'
import { SPOTS } from '@/constants/spots'
import {
  addDrillResult, getOrCreateActiveSession, endSession, listZones,
  getSession, updateSessionTitle,ensureSeedZones
} from '@/db/repositories'
import type { Zone } from '@/db/dexie'
import { useEdgeSwipeToHistory } from '@/hooks/useEdgeSwipeToHistory'
  import type { NewDrillResult } from '@/db/types'


/** 入力の正規化: 数字以外を除去 → 空なら ''、それ以外は整数文字に */
function normalizeNumString(raw: string) {
  const onlyDigits = raw.replace(/\D/g, '')
  if (onlyDigits === '') return ''
  return String(parseInt(onlyDigits, 10)) // 先頭ゼロを自動除去
}
/** 文字列→数値（空なら0） */
const toInt = (s: string) => (s === '' ? 0 : parseInt(s, 10))

export default function SessionPage() {
  const router = useRouter()
  useEdgeSwipeToHistory({ edgeStartRatio: 1/3, threshold: 80, maxPull: 160, flingMs: 220 })

  const [sessionId, setSessionId] = useState<number>()
  const [zones, setZones] = useState<Zone[]>([])
  const [activeSpotId, setActiveSpotId] = useState<number>(SPOTS[0].id)

  // タイトル（セッションごとに保存）
  const [title, setTitle] = useState('タイトル')
  const [editingTitle, setEditingTitle] = useState(false)

  // ← 数値は string で管理：iOS Safari の 0 固定/先頭ゼロ問題を回避
  const [attemptsStr, setAttemptsStr] = useState<string>('') // '' は空
  const [makesStr, setMakesStr] = useState<string>('')

  // 派生の数値（保存/検証用）
  const attempts = useMemo(() => toInt(attemptsStr), [attemptsStr])
  const makes    = useMemo(() => toInt(makesStr),    [makesStr])

  useEffect(() => {
    (async () => {
      await ensureSeedZones()
      const sid = await getOrCreateActiveSession()
      setSessionId(sid)
      const s = await getSession(sid)
      if (s?.note) setTitle(s.note)
      setZones(await listZones())
    })().catch(console.error)
  }, [])

  async function commitTitle() {
    if (!sessionId) return
    await updateSessionTitle(sessionId, title.trim())
    setEditingTitle(false)
  }

  const zoneId = useMemo(() => {
    const is3 = SPOTS.find(s => s.id === activeSpotId)?.is3pt
    const match = zones.find(z => Boolean(z.is3pt) === Boolean(is3))
    return match?.id
  }, [zones, activeSpotId])

  const canSave = useMemo(
    () => Boolean(sessionId && zoneId) && attempts > 0 && makes >= 0 && attempts >= makes, // ★ attempts>0 推奨
    [sessionId, zoneId, attempts, makes]
  )



  async function save() {
    if (!canSave || !sessionId || !zoneId) return
    const payload: NewDrillResult = {
      sessionId, zoneId, spotId: activeSpotId, attempts, makes
    }
    await addDrillResult(payload)
    setAttemptsStr(''); setMakesStr('')
  }
  

  const dateLabel = (() => {
    const d = new Date()
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  })()

  const activeSpot = SPOTS.find(s => s.id === activeSpotId)

  // ±ボタンのヘルパ
  const incStr = (s: string, delta: number) => {
    const next = Math.max(0, toInt(s) + delta)
    return String(next)
  }

  return (
    <main className="page-fit" style={{ padding: 16 }}>
      {/* タイトル行（ペンで編集） */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          {editingTitle ? (
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={e => { if (e.key === 'Enter') commitTitle() }}
              autoFocus
              style={{
                fontSize: 24, fontWeight: 800, padding: '2px 6px',
                border: '1px solid #555', borderRadius: 4, background: '#222', color: '#fff'
              }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{title}</div>
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                aria-label="edit title"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa', fontSize: 18, WebkitTapHighlightColor: 'transparent' }}
              >✏️</button>
            </div>
          )}
          <div style={{ color: '#9aa', marginTop: 4 }}>{dateLabel}</div>
        </div>
      </div>

      {/* コート */}
      <div style={{ marginTop: 8 }}>
        <Court width={340} activeId={activeSpotId} onSelect={setActiveSpotId} flipY />
      </div>

      {/* スポット名 */}
      <div style={{ marginTop: 8, fontSize: 22, fontWeight: 800, textAlign: 'center' }}>
        {activeSpot?.label ?? '-'}
      </div>

      {/* Attempt / Make：直接入力（text+numeric）＋ ± */}
      <div style={{ marginTop: 8, display: 'grid', gap: 12, width: '100%', maxWidth: 360, marginInline: 'auto' }}>
        <Row
          label="Attempt"
          value={attemptsStr}
          onChange={(raw) => setAttemptsStr(normalizeNumString(raw))}
          onMinus={() => setAttemptsStr(v => incStr(v, -1))}
          onPlus={() => setAttemptsStr(v => incStr(v, +1))}
        />
        <Row
          label="Make"
          value={makesStr}
          onChange={(raw) => setMakesStr(normalizeNumString(raw))}
          onMinus={() => setMakesStr(v => incStr(v, -1))}
          onPlus={() => setMakesStr(v => incStr(v, +1))}
        />
      </div>

      {/* Enter / End Session */}
      <div style={{ marginTop: 12, textAlign: 'center', display: 'grid', gap: 10, width: 220, marginInline: 'auto' }}>
        <button
          type="button" // ← Safari対策
          disabled={!canSave}
          onClick={save}
          style={{
            padding: '10px 22px', borderRadius: 10,
            background: canSave ? '#0ea5e9' : '#2b4a58',
            color: '#dff3ff', border: '1px solid #2aa3e0',
            fontWeight: 800, cursor: canSave ? 'pointer' : 'not-allowed',
            WebkitTapHighlightColor: 'transparent', WebkitAppearance: 'none', touchAction: 'manipulation'
          }}
        >Enter</button>

        <button
          type="button" // ← Safari対策
          disabled={!sessionId}
          onClick={async () => {
            if (!sessionId) return
            await endSession(sessionId)
            router.replace('/history') // 履歴へ
          }}
          style={{
            padding: '10px 22px', borderRadius: 10,
            background: '#2a2a2a', color: '#eee', border: '1px solid #555',
            fontWeight: 800, cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent', WebkitAppearance: 'none', touchAction: 'manipulation'
          }}
        >End Session</button>
      </div>
    </main>
  )
}

function Row({
  label, value, onMinus, onPlus, onChange
}:{
  label: string
  value: string               // ← string
  onMinus: () => void
  onPlus: () => void
  onChange: (v: string) => void
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '88px minmax(0,1fr) 40px 40px',
        alignItems: 'center',
        gap: 10,
        width: '100%'
      }}
    >
      <div style={{ color: '#b9b9b9', textAlign: 'left' }}>{label}</div>
      <input
        type="text"             // ← Safari安定のため number は使わない
        inputMode="numeric"     // 数字キーボード
        pattern="\d*"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          height: 38,
          border: '1px solid #555',
          borderRadius: 8,
          background: '#222',
          color: '#fff',
          textAlign: 'center',
          fontSize: 18,
          fontWeight: 700,
          width: '100%',
          boxSizing: 'border-box'
        }}
      />
      <button type="button" onClick={onMinus}
        style={{ height: 38, borderRadius: 8, background: 'none', border: '1px solid #777', color: '#ddd', fontSize: 18, cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent', WebkitAppearance: 'none', touchAction: 'manipulation' }}
      >－</button>
      <button type="button" onClick={onPlus}
        style={{ height: 38, borderRadius: 8, background: 'none', border: '1px solid #777', color: '#ddd', fontSize: 18, cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent', WebkitAppearance: 'none', touchAction: 'manipulation' }}
      >＋</button>
    </div>
  )
}
