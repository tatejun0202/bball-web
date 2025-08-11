// src/app/settings/page.tsx
'use client'
import { useHorizontalSwipe } from '@/hooks/useHorizontalSwipe'
import { db } from '@/db/dexie'

export default function SettingsPage() {
  useHorizontalSwipe({ threshold: 80, maxPull: 160, flingMs: 220 })

  // 全履歴削除機能
  const handleDeleteAllHistory = async () => {
    if (!confirm('全ての履歴データを削除しますか？\nこの操作は取り消せません。')) {
      return
    }

    // 二重確認
    if (!confirm('本当に削除しますか？\n全てのセッション、練習記録が削除されます。')) {
      return
    }

    try {
      // 全テーブルのデータを削除
      await db.transaction('rw', [db.sessions, db.drillResults], async () => {
        await db.sessions.clear()
        await db.drillResults.clear()
      })
      
      alert('全ての履歴データを削除しました。')
    } catch (error) {
      console.error('データ削除エラー:', error)
      alert('データの削除に失敗しました。')
    }
  }

  // データエクスポート機能（準備中）
  const handleExportData = async () => {
    try {
      const sessions = await db.sessions.toArray()
      const drillResults = await db.drillResults.toArray()
      
      const exportData = {
        version: '2.0.0',
        exportDate: new Date().toISOString(),
        sessions,
        drillResults
      }
      
      const dataStr = JSON.stringify(exportData, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `bball-data-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('エクスポートエラー:', error)
      alert('データのエクスポートに失敗しました。')
    }
  }

  return (
    <main className="page-fit" style={{ padding: 16 }}>
      {/* タイトル */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Settings</h1>
      </div>

      {/* 設定項目 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        {/* バージョン情報 */}
        <SettingSection title="アプリ情報">
          <SettingItem
            label="バージョン"
            value="v2.0.0"
          />
          <SettingItem
            label="ビルド日"
            value="2025/08/11"
          />
        </SettingSection>

        {/* データ管理 */}
        <SettingSection title="データ管理">
          <SettingButton
            label="データエクスポート"
            description="練習データをJSON形式でエクスポート"
            onClick={handleExportData}
          />
          <SettingButton
            label="履歴データ全削除"
            description="全てのセッション・練習記録を削除"
            danger
            onClick={handleDeleteAllHistory}
          />
        </SettingSection>

        {/* 表示設定 */}
        <SettingSection title="表示設定">
          <SettingItem
            label="ダークモード"
            value="有効"
          />
          <SettingItem
            label="言語"
            value="日本語"
          />
        </SettingSection>

        {/* 開発者情報 */}
        <SettingSection title="その他">
          <SettingItem
            label="開発者"
            value="BBall Team"
          />
          <SettingButton
            label="フィードバック"
            description="改善要望やバグ報告"
            onClick={() => {
              // TODO: フィードバック機能
              alert('フィードバック機能は準備中です')
            }}
          />
        </SettingSection>

      </div>
    </main>
  )
}

function SettingSection({ 
  title, 
  children 
}: { 
  title: string
  children: React.ReactNode 
}) {
  return (
    <div>
      <h2 style={{
        fontSize: 16,
        fontWeight: 600,
        color: '#9aa',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {title}
      </h2>
      <div style={{
        background: '#252525',
        borderRadius: 8,
        border: '1px solid #374151',
        overflow: 'hidden'
      }}>
        {children}
      </div>
    </div>
  )
}

function SettingItem({ 
  label, 
  value 
}: { 
  label: string
  value: string 
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 20px',
      borderBottom: '1px solid #374151'
    }}>
      <span style={{ color: '#ddd', fontSize: 15 }}>{label}</span>
      <span style={{ color: '#9aa', fontSize: 14 }}>{value}</span>
    </div>
  )
}

function SettingButton({ 
  label, 
  description, 
  danger = false,
  onClick 
}: { 
  label: string
  description?: string
  danger?: boolean
  onClick: () => void 
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        padding: '16px 20px',
        background: 'none',
        border: 'none',
        borderBottom: '1px solid #374151',
        width: '100%',
        cursor: 'pointer',
        textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
        WebkitAppearance: 'none',
        touchAction: 'manipulation'
      }}
    >
      <span style={{ 
        color: danger ? '#ef4444' : '#ddd', 
        fontSize: 15,
        fontWeight: 500
      }}>
        {label}
      </span>
      {description && (
        <span style={{ 
          color: '#9aa', 
          fontSize: 13, 
          marginTop: 4 
        }}>
          {description}
        </span>
      )}
    </button>
  )
}