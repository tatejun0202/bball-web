// src/app/session/page.tsx (V2版)
'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
// import { useHorizontalSwipe } from '@/hooks/useHorizontalSwipe'
import FreePositionCourt from '@/components/FreePositionCourt'
import VideoUploadScreen from '@/components/VideoUploadScreen'
import { 
  getOrCreateActiveSession, 
  getSession, 
  updateSessionTitle, 
  ensureSeedZones,
  listZones,
  listSessions,
  endSession
} from '@/db/repositories'
import { addDrillResultV2 } from '@/db/repositories-v2'
import { detectArea } from '@/constants/court-areas'
import { SPOTS } from '@/constants/spots'
import type { Zone } from '@/db/dexie'
import type { NewDrillResult, PositionInfo } from '@/db/types'
import type { PreprocessingResult } from '@/utils/videoPreprocessor'
import { videoAnalysisApi, type AnalysisProgress, type ShotDetection } from '@/services/videoAnalysisApi'

// 文字列から数値への変換（空文字は0）
const toInt = (s: string) => (s === '' ? 0 : parseInt(s, 10))

// 数値文字列の正規化（不正な文字を除去）
const normalizeNumString = (s: string) => s.replace(/[^\d]/g, '')

export default function SessionPageV2() {
  const router = useRouter()
  // useHorizontalSwipe({ threshold: 80, maxPull: 160, flingMs: 220 }) // 一時無効化

  const [sessionId, setSessionId] = useState<number>()
  const [zones, setZones] = useState<Zone[]>([])
  
  // 記録モードの状態
  const [recordingMode, setRecordingMode] = useState<'manual' | 'video'>('manual')
  const [showVideoUpload, setShowVideoUpload] = useState(false)
  
  // 動画解析の状態
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null)
  // const [analysisResults, setAnalysisResults] = useState<ShotDetection[] | null>(null)
  
  // 選択中の位置情報
  const [selectedPosition, setSelectedPosition] = useState<PositionInfo | null>(null)
  // 固定スポット表示のトグル
  const [showFixedSpots, setShowFixedSpots] = useState<boolean>(false)

  // スポットモードの切り替え処理
  const handleSpotModeToggle = () => {
    const newMode = !showFixedSpots
    setShowFixedSpots(newMode)
    
    if (newMode) {
      // スポットモードON時: Top 3スポットをデフォルト選択
      const top3Spot = SPOTS.find(s => s.label === 'Top 3')
      if (top3Spot) {
        const defaultPosition: PositionInfo = {
          type: 'fixed',
          spotId: top3Spot.id,
          label: top3Spot.label,
          is3pt: top3Spot.is3pt,
          x: top3Spot.x,
          y: top3Spot.y,
          attempts: 0,
          makes: 0,
          fgPercentage: 0
        }
        setSelectedPosition(defaultPosition)
      }
    } else {
      // 自由配置モードON時: 選択をリセット
      setSelectedPosition(null)
    }
  }

  // タイトル（セッションごとに保存）
  const [title, setTitle] = useState('Session1')
  const [editingTitle, setEditingTitle] = useState(false)

  // 試投数・成功数（string管理でiOS Safari対応）
  const [attemptsStr, setAttemptsStr] = useState<string>('')
  const [makesStr, setMakesStr] = useState<string>('')

  // 派生の数値（保存・検証用）
  const attempts = useMemo(() => toInt(attemptsStr), [attemptsStr])
  const makes = useMemo(() => toInt(makesStr), [makesStr])

  useEffect(() => {
    (async () => {
      await ensureSeedZones()
      const sid = await getOrCreateActiveSession()
      setSessionId(sid)
      const s = await getSession(sid)
      
      // タイトル設定: 既存のタイトルがあればそれを使用、なければ自動生成
      if (s?.note) {
        setTitle(s.note)
      } else {
        // セッション数を取得して新しいタイトルを生成
        const sessions = await listSessions()
        const sessionCount = sessions.length
        const newTitle = `Session${sessionCount}`
        setTitle(newTitle)
        // データベースにも保存
        await updateSessionTitle(sid, newTitle)
      }
      
      setZones(await listZones())
    })().catch(console.error)
  }, [])

  async function commitTitle() {
    if (!sessionId) return
    await updateSessionTitle(sessionId, title.trim())
    setEditingTitle(false)
  }

  // 位置選択時の処理
  const handlePositionSelect = (position: PositionInfo) => {
    setSelectedPosition(position)
  }

  // 自由配置時の処理
  const handleFreePosition = (x: number, y: number) => {
    // エリアを自動判定（現在は使用しないがdetectArea関数を保持）
    // const area = detectArea(x, y)
    
    const newPosition: PositionInfo = {
      type: 'free',
      x,
      y,
      attempts: 0,
      makes: 0,
      fgPercentage: 0
    }
    
    setSelectedPosition(newPosition)
  }

  // 保存可能かの判定
  const canSave = useMemo(() => {
    return Boolean(
      sessionId && 
      selectedPosition &&
      attempts > 0 && 
      makes >= 0 && 
      attempts >= makes
    )
  }, [sessionId, selectedPosition, attempts, makes])

  // データ保存
  const save = async () => {
    if (!canSave || !sessionId || !selectedPosition) return

    // 現在のモードを判定
    const currentMode: 'spot' | 'free' = showFixedSpots ? 'spot' : 'free'

    // エリアから2P/3Pを判定してzoneIdを取得
    let zoneId: number
    if (selectedPosition.type === 'fixed') {
      // 固定スポットの場合
      const spot = SPOTS.find(s => s.id === selectedPosition.spotId)
      const is3P = spot?.is3pt ?? false
      const zone = zones.find(z => Boolean(z.is3pt) === Boolean(is3P))
      zoneId = zone?.id ?? zones[0]?.id ?? 1
    } else {
      // 自由配置の場合、座標からエリア判定
      const area = detectArea(selectedPosition.x, selectedPosition.y)
      const is3P = area?.is3pt ?? false
      const zone = zones.find(z => Boolean(z.is3pt) === Boolean(is3P))
      zoneId = zone?.id ?? zones[0]?.id ?? 1
    }

    const payload: NewDrillResult = {
      sessionId,
      zoneId,
      attempts,
      makes,
      position: selectedPosition.type === 'fixed' 
        ? { type: 'fixed', spotId: selectedPosition.spotId! }
        : { type: 'free', x: selectedPosition.x, y: selectedPosition.y }
    }

    await addDrillResultV2(payload, currentMode)
    
    // 入力値をリセット
    setAttemptsStr('')
    setMakesStr('')
  }

  // 動画アップロード完了の処理
  const handleVideoUploadComplete = async (result: PreprocessingResult) => {
    try {
      console.log('Video preprocessing completed:', result)
      
      // サーバー解析リクエストの準備
      const analysisRequest = {
        frames: result.frames,
        metadata: {
          targetFps: result.metadata.targetFps || 2,
          originalDuration: result.duration,
          targetWidth: result.metadata.targetWidth || 480,
          targetHeight: result.metadata.targetHeight || 270,
          compressionRatio: result.metadata.compressionRatio
        }
      }

      // 解析進捗のリセット
      setAnalysisProgress({
        stage: 'uploading',
        progress: 0,
        message: 'サーバーに送信中...'
      })

      // Railway サーバーで解析実行
      const analysisResult = await videoAnalysisApi.analyzeFrames(
        analysisRequest,
        (progress) => setAnalysisProgress(progress)
      )

      console.log('Analysis completed:', analysisResult)
      
      // 解析結果を保存
      // setAnalysisResults(analysisResult.shots)
      
      // 新しいセッションを作成して結果を保存
      await saveAnalysisResults(analysisResult.shots)
      
      setShowVideoUpload(false)
      setAnalysisProgress(null)
      
      // 成功メッセージ
      alert(`解析完了！\nシュート検出数: ${analysisResult.summary.total_attempts}\n成功率: ${analysisResult.summary.fg_percentage.toFixed(1)}%`)
      
    } catch (error) {
      console.error('Video analysis error:', error)
      setAnalysisProgress({
        stage: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : '解析に失敗しました'
      })
      
      // 3秒後にエラー状態をクリア
      setTimeout(() => {
        setAnalysisProgress(null)
        setShowVideoUpload(false)
      }, 3000)
    }
  }

  // 解析結果をデータベースに保存
  const saveAnalysisResults = async (shots: ShotDetection[]) => {
    if (!sessionId || shots.length === 0) return

    try {
      // 新しいセッション作成（動画解析用）
      const sessions = await listSessions()
      const sessionCount = sessions.length
      const videoSessionTitle = `AI解析 - Session${sessionCount + 1}`
      
      // セッションタイトル更新
      await updateSessionTitle(sessionId, videoSessionTitle)

      // 各ショットをdrillResultとして保存
      for (const shot of shots) {
        // 解析サーバーからの座標は正規化値(0-1)のため、
        // ゾーン判定用に実寸へ変換しつつ、保存は正規化値で行う
        const normX = shot.position.x
        const normY = shot.position.y
        const courtX = normX * 340 // コート幅
        const courtY = normY * 238 // コート高（アスペクト比調整済み）

        // エリア判定
        const area = detectArea(courtX, courtY)
        const is3P = area?.is3pt ?? false
        const zone = zones.find(z => Boolean(z.is3pt) === Boolean(is3P))
        const zoneId = zone?.id ?? zones[0]?.id ?? 1

        const payload: NewDrillResult = {
          sessionId,
          zoneId,
          attempts: 1,
          makes: shot.result === 'make' ? 1 : 0,
          // 保存する座標は0-1の正規化値を使用
          position: { type: 'free', x: normX, y: normY }
        }

        await addDrillResultV2(payload, 'free')
      }

      // セッション終了
      await endSession(sessionId)
      
      // 履歴画面に遷移
      router.replace('/history')
      
    } catch (error) {
      console.error('Failed to save analysis results:', error)
      throw error
    }
  }

  const dateLabel = (() => {
    const d = new Date()
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  })()

  // ±ボタンのヘルパー
  const incStr = (s: string, delta: number) => {
    const next = Math.max(0, toInt(s) + delta)
    return String(next)
  }

  // 動画アップロード画面の表示制御
  if (showVideoUpload || analysisProgress) {
    // 解析進捗画面
    if (analysisProgress) {
      return (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: '#1a1a1a',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div style={{
            textAlign: 'center',
            maxWidth: 400,
            width: '100%'
          }}>
            {analysisProgress.stage === 'error' ? (
              <>
                <div style={{ fontSize: 48, marginBottom: 24 }}>❌</div>
                <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: '#ef4444' }}>
                  解析エラー
                </div>
                <div style={{ color: '#9aa', marginBottom: 32 }}>
                  {analysisProgress.message}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 48, marginBottom: 24 }}>
                  {analysisProgress.stage === 'uploading' && '📤'}
                  {analysisProgress.stage === 'processing' && '🧠'}
                  {analysisProgress.stage === 'complete' && '✅'}
                </div>
                <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>
                  {analysisProgress.stage === 'uploading' && 'データ送信中...'}
                  {analysisProgress.stage === 'processing' && 'AI解析中...'}
                  {analysisProgress.stage === 'complete' && '解析完了！'}
                </div>
                <div style={{ color: '#9aa', marginBottom: 32 }}>
                  {analysisProgress.message}
                </div>

                {/* プログレスバー */}
                {analysisProgress.stage !== 'complete' && (
                  <>
                    <div style={{
                      width: '100%',
                      height: 8,
                      background: '#333',
                      borderRadius: 4,
                      marginBottom: 16,
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${analysisProgress.progress}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #0ea5e9, #06b6d4)',
                        borderRadius: 4,
                        transition: 'width 0.3s ease'
                      }} />
                    </div>

                    <div style={{ color: '#9aa', fontSize: 14, marginBottom: 24 }}>
                      {analysisProgress.progress.toFixed(1)}% 完了
                    </div>
                  </>
                )}
              </>
            )}

            <button
              onClick={() => {
                setAnalysisProgress(null)
                setShowVideoUpload(false)
              }}
              style={{
                padding: '8px 16px',
                background: 'none',
                border: '1px solid #555',
                color: '#9aa',
                borderRadius: 8,
                cursor: 'pointer'
              }}
            >
              {analysisProgress.stage === 'error' ? '閉じる' : 'キャンセル'}
            </button>
          </div>
        </div>
      )
    }

    // 動画アップロード画面
    return (
      <VideoUploadScreen
        onUploadComplete={handleVideoUploadComplete}
        onBack={() => setShowVideoUpload(false)}
      />
    )
  }

  return (
    <main className="page-fit" style={{ padding: 16 }}>
      {/* タイトル行とモード選択 */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                  style={{ 
                    background: 'none', border: 'none', cursor: 'pointer', 
                    color: '#9aa', fontSize: 18, WebkitTapHighlightColor: 'transparent' 
                  }}
                >✏️</button>
              </div>
            )}
            
            {/* モード選択ドロップダウン */}
            <select
              value={recordingMode}
              onChange={(e) => setRecordingMode(e.target.value as 'manual' | 'video')}
              style={{
                padding: '4px 8px',
                borderRadius: 4,
                border: '1px solid #555',
                background: '#2a2a2a',
                color: '#ddd',
                fontSize: 14,
                cursor: 'pointer',
                WebkitAppearance: 'none',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              <option value="manual">手動記録</option>
              <option value="video">動画アップロード</option>
            </select>
          </div>
        </div>
        <div style={{ color: '#9aa', fontSize: 12 }}>{dateLabel}</div>
      </div>

      {/* 手動記録モード */}
      {recordingMode === 'manual' && (
        <>
          {/* コート */}
          <div style={{ marginTop: 12 }}>
            <div style={{ position: 'relative' }}>
              {/* トグルボタン（コート右上外側） */}
              <div style={{
                position: 'absolute',
                top: -40,
                right: 0,
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 8px',
                background: 'rgba(28, 28, 28, 0.9)',
                borderRadius: 16,
                fontSize: 12,
                fontWeight: 600
              }}>
                <span style={{ color: showFixedSpots ? '#ddd' : '#9aa' }}>Spot Mode</span>
                <button
                  onClick={handleSpotModeToggle}
                  style={{
                    width: 40,
                    height: 20,
                    borderRadius: 10,
                    border: 'none',
                    background: showFixedSpots ? '#0ea5e9' : '#555',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background 0.2s ease',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                >
                  <div style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: 2,
                    left: showFixedSpots ? 22 : 2,
                    transition: 'left 0.2s ease'
                  }} />
                </button>
              </div>
              
              <FreePositionCourt
                width={340}
                mode="select"
                selectedPosition={selectedPosition}
                onPositionSelect={handlePositionSelect}
                onFreePosition={handleFreePosition}
                flipY={true}
                showFixedSpots={showFixedSpots}
              />
            </div>
          </div>

          {/* Attempt / Make：直接入力（text+numeric）＋ ± */}
          <div style={{ 
            marginTop: 16, 
            display: 'grid', 
            gap: 12, 
            width: '100%', 
            maxWidth: 360, 
            marginInline: 'auto' 
          }}>
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
          <div style={{ 
            marginTop: 16, 
            textAlign: 'center', 
            display: 'grid', 
            gap: 10, 
            width: 220, 
            marginInline: 'auto' 
          }}>
            <button
              type="button"
              disabled={!canSave}
              onClick={save}
              style={{
                padding: '12px 24px', 
                borderRadius: 10,
                background: canSave ? '#0ea5e9' : '#2b4a58',
                color: '#dff3ff', 
                border: '1px solid #2aa3e0',
                fontWeight: 800, 
                cursor: canSave ? 'pointer' : 'not-allowed',
                WebkitTapHighlightColor: 'transparent', 
                WebkitAppearance: 'none', 
                touchAction: 'manipulation',
                fontSize: 16
              }}
            >
              {selectedPosition ? 'Enter' : '位置を選択してください'}
            </button>

            <button
              type="button"
              disabled={!sessionId}
              onClick={async () => {
                if (!sessionId) return
                await endSession(sessionId)
                router.replace('/history')
              }}
              style={{
                padding: '10px 22px', 
                borderRadius: 10,
                background: '#2a2a2a', 
                color: '#eee', 
                border: '1px solid #555',
                fontWeight: 800, 
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent', 
                WebkitAppearance: 'none', 
                touchAction: 'manipulation'
              }}
            >
              End Session
            </button>
          </div>
        </>
      )}

      {/* 動画アップロードモード */}
      {recordingMode === 'video' && (
        <div style={{
          marginTop: 32,
          textAlign: 'center',
          padding: 32,
          border: '2px dashed #555',
          borderRadius: 12,
          background: '#2a2a2a'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📹</div>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>動画アップロード</div>
          <div style={{ color: '#9aa', marginBottom: 24, lineHeight: 1.5 }}>
            バスケットボールの練習動画をアップロードして<br />
            自動でシュートを検出・記録します
          </div>
          <button
            type="button"
            style={{
              padding: '12px 32px',
              borderRadius: 10,
              background: '#0ea5e9',
              color: '#fff',
              border: 'none',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              WebkitAppearance: 'none',
              touchAction: 'manipulation'
            }}
            onClick={() => setShowVideoUpload(true)}
          >
            動画を選択
          </button>
          <div style={{ 
            marginTop: 16, 
            fontSize: 12, 
            color: '#777',
            lineHeight: 1.4 
          }}>
            対応形式: MP4, MOV, AVI<br />
            最大サイズ: 1000MB、最大時間: 20分
          </div>
        </div>
      )}
    </main>
  )
}

function Row({
  label, value, onMinus, onPlus, onChange
}:{
  label: string
  value: string
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
        type="text"
        inputMode="numeric"
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
        style={{ 
          height: 38, borderRadius: 8, background: 'none', 
          border: '1px solid #777', color: '#ddd', fontSize: 18, cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent', WebkitAppearance: 'none', touchAction: 'manipulation' 
        }}
      >－</button>
      <button type="button" onClick={onPlus}
        style={{ 
          height: 38, borderRadius: 8, background: 'none', 
          border: '1px solid #777', color: '#ddd', fontSize: 18, cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent', WebkitAppearance: 'none', touchAction: 'manipulation' 
        }}
      >＋</button>
    </div>
  )
}