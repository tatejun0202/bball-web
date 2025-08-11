// src/app/settings/page.tsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { listSessions, deleteSessionsCascade, clearAllHistory } from '@/db/repositories'
import type { Session } from '@/db/dexie'

function fmt(ts?: number) {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export default function SettingsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selected, setSelected] = useState<Record<number, boolean>>({})

  useEffect(() => {
    ;(async () => {
      const ss = await listSessions()
      setSessions(ss)
      setSelected({})
    })().catch(console.error)
  }, [])

  const allChecked = useMemo(() => {
    if (sessions.length === 0) return false
    return sessions.every(s => selected[s.id!] === true)
  }, [sessions, selected])

  const selectedIds = useMemo(
    () => sessions.filter(s => selected[s.id!]).map(s => s.id!) as number[],
    [sessions, selected]
  )

  async function refresh() {
    const ss = await listSessions()
    setSessions(ss)
    setSelected({})
  }

  async function onDeleteSelected() {
    if (selectedIds.length === 0) return
    if (!window.confirm(`${selectedIds.length}件の履歴を削除します。よろしいですか？`)) return
    await deleteSessionsCascade(selectedIds)
    await refresh()
    alert('削除しました')
  }

  async function onDeleteAll() {
    if (sessions.length === 0) return
    if (!window.confirm('すべての履歴を削除します。この操作は取り消せません。')) return
    await clearAllHistory()
    await refresh()
    alert('全削除しました')
  }

  return (
    <main style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Settings</h1>
        <Link href={'/history' as Route} style={{ color: '#9ecbff' }}>
          ＜ Back
        </Link>
      </div>

      {/* 履歴の選択削除 */}
      <section style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Play Histories</h2>
          <button
            type="button"
            onClick={() => {
              if (allChecked) {
                setSelected({})
              } else {
                const next: Record<number, boolean> = {}
                for (const s of sessions) next[s.id!] = true
                setSelected(next)
              }
            }}
            style={{
              border: '1px solid #666',
              background: 'none',
              color: '#ddd',
              borderRadius: 8,
              padding: '6px 10px',
              cursor: 'pointer',
              // ★iOS対策
              WebkitTapHighlightColor: 'transparent',
              WebkitAppearance: 'none',
              touchAction: 'manipulation'
            }}
          >
            {allChecked ? 'Uncheck all' : 'Check all'}
          </button>

          <button
            type="button"
            onClick={onDeleteSelected}
            disabled={selectedIds.length === 0}
            style={{
              marginLeft: 'auto',
              border: '1px solid #e57373',
              background: selectedIds.length ? '#7a2e2e' : '#3a2a2a',
              color: '#ffd6d6',
              borderRadius: 8,
              padding: '6px 12px',
              fontWeight: 700,
              cursor: selectedIds.length ? 'pointer' : 'not-allowed',
              // ★iOS対策
              WebkitTapHighlightColor: 'transparent',
              WebkitAppearance: 'none',
              touchAction: 'manipulation'
            }}
          >
            Delete selected
          </button>
        </div>

        <ul style={{ marginTop: 10, display: 'grid', gap: 6 }}>
          {sessions.map(s => {
            const cid = `chk-${s.id}`
            const href: Route = `/result/${String(s.id)}` as Route
            return (
              <li
                key={s.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '24px 1fr auto',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 6px',
                  borderBottom: '1px solid #2a2a2a'
                }}
              >
                <input
                  id={cid}
                  type="checkbox"
                  checked={Boolean(selected[s.id!])}
                  onChange={e => setSelected(prev => ({ ...prev, [s.id!]: e.target.checked }))}
                />
                <label htmlFor={cid} style={{ cursor: 'pointer' }}>
                  <div style={{ fontWeight: 700 }}>
                    {s.note || 'Session'}
                    {!s.endedAt && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 11,
                          fontWeight: 800,
                          color: '#fff',
                          background: '#d22',
                          padding: '2px 6px',
                          borderRadius: 999
                        }}
                      >
                        current
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#9aa', marginTop: 2 }}>
                    {fmt(s.startedAt)}
                    {s.endedAt ? ` 〜 ${fmt(s.endedAt)}` : ''}
                  </div>
                </label>
                <Link href={href} style={{ color: '#9ecbff', whiteSpace: 'nowrap' }}>
                  View ›
                </Link>
              </li>
            )
          })}
          {sessions.length === 0 && <li style={{ padding: '16px 4px', color: '#9aa' }}>履歴はありません</li>}
        </ul>
      </section>

      {/* Danger Zone */}
      <section style={{ marginTop: 24 }}>
        <div style={{ fontSize: 14, color: '#f5bdbd', marginBottom: 8, fontWeight: 700 }}>Danger Zone</div>
        <button
          type="button"
          onClick={onDeleteAll}
          disabled={sessions.length === 0}
          style={{
            width: '100%',
            border: '1px solid #e57373',
            background: sessions.length ? '#7a2e2e' : '#3a2a2a',
            color: '#ffd6d6',
            borderRadius: 10,
            padding: '10px 14px',
            fontWeight: 800,
            cursor: sessions.length ? 'pointer' : 'not-allowed',
            // ★iOS対策
            WebkitTapHighlightColor: 'transparent',
            WebkitAppearance: 'none',
            touchAction: 'manipulation'
          }}
        >
          Delete all histories
        </button>
      </section>
    </main>
  )
}