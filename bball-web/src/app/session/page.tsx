// src/app/session/page.tsx (V3版 - カメラ録画機能統合)
'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useHorizontalSwipe } from '@/hooks/useHorizontalSwipe'
import FreePositionCourt from '@/components/FreePositionCourt'
import LiveCameraAnalysis from '@/components/LiveCameraAnalysis'
import VideoUploadAnalysis from '@/components/VideoUploadAnalysis'
import VideoAnalysisProgress from '@/components/VideoAnalysisProgress'
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

// 文字列から数値への変換（空文字は0）
const toInt = (s: string) => (s === '' ? 0 : parseInt(s, 10))

// 数値文字列の正規化（不正な文字を除去）
const normalizeNumString = (s: string) => s.replace(/[^\d]/g, '')

// モードの型定義
type RecordingMode = 'manual' | 'live' | 'upload'
type AnalysisStep = 'mode-selection' | 'camera-recording' | 'video-upload' | 'analysis-progress' | 'results-review'

// シュート検出結果の型定義
interface ShotDetection {
  timestamp: number
  position: { x: number; y: number }
  result: 'make' | 'miss'
  confidence: number
}

interface VideoQualityCheck {
  duration: number
  resolution: { width: number; height: number }
  hasAudio: boolean
  estimatedAnalysisTime: number
  qualityScore: number
}

export default function SessionPageV3() {
  const router = useRouter()
  useHorizontalSwipe({ threshold: 80, maxPull: 160, flingMs: 220 })

  const [sessionId, setSessionId] = useState<number>()
  const [zones, setZones] = useState<Zone[]>([])
  
  // V3: 録画モードの状態
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('manual')
  
  // V3: 解析フローの状態管理
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>('mode-selection')
  const [currentVideoBlob, setCurrentVideoBlob] = useState<Blob | null>(null)
  const [currentVideoFile, setCurrentVideoFile] = useState<File | null>(null)
  const [videoQualityCheck, setVideoQualityCheck] = useState<VideoQualityCheck | null>(null)
  const [detectedShots, setDetectedShots] = useState<ShotDetection[]>([])
  const [isAnalysisComplete, setIsAnalysisComplete] = useState(false)
  
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
    // エリアを自動判定
    const area = detectArea(x, y)
    
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

  // V3: ライブカメラ録画完了の処理
  const handleLiveCameraComplete = async (videoBlob: Blob) => {
    setCurrentVideoBlob(videoBlob)
    setAnalysisStep('analysis-progress')
  }

  // V3: 動画アップロード選択の処理
  const handleVideoUploadSelected = async (file: File, qualityCheck: VideoQualityCheck) => {
    setCurrentVideoFile(file)
    setVideoQualityCheck(qualityCheck)
    setAnalysisStep('analysis-progress')
  }

  // V3: 解析完了時の処理
  const handleAnalysisComplete = async (shots: ShotDetection[]) => {
    setDetectedShots(shots)
    setIsAnalysisComplete(true)
    
    // 検出されたシュートをV2システムに保存
    if (sessionId && shots.length > 0) {
      for (const shot of shots) {
        // 座標からエリア判定
        const area = detectArea(shot.position.x, shot.position.y)
        const is3P = area?.is3pt ?? false
        const zone = zones.find(z => Boolean(z.is3pt) === Boolean(is3P))
        const zoneId = zone?.id ?? zones[0]?.id ?? 1

        const payload: NewDrillResult = {
          sessionId,
          zoneId,
          attempts: 1,
          makes: shot.result === 'make' ? 1 : 0,
          position: { type: 'free', x: shot.position.x, y: shot.position.y }
        }

        await addDrillResultV2(payload, 'free') // V3では常に自由配置モードで保存
      }
    }
    
    setAnalysisStep('results-review')
  }

  // V3: 解析フローのリセット
  const resetAnalysisFlow = () => {
    setAnalysisStep('mode-selection')
    setCurrentVideoBlob(null)
    setCurrentVideoFile(null)
    setVideoQualityCheck(null)
    setDetectedShots([])
    setIsAnalysisComplete(false)
  }

  // データ保存（手動モード用）
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

  const dateLabel = (() => {
    const d = new Date()
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  })()

  // ±ボタンのヘルパー
  const incStr = (s: string, delta: number) => {
    const next = Math.max(0, toInt(s) + delta)
    return String(next)
  }

  return (
    <main className="page-fit" style={{ padding: 16 }}>
      {/* タイトル行（ペンで編集） */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
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
                style={{ 
                  background: 'none', border: 'none', cursor: 'pointer', 
                  color: '#9aa', fontSize: 18, WebkitTapHighlightColor: 'transparent' 
                }}
              >✏️</button>
            </div>
          )}
          <div style={{ color: '#9aa', marginTop: 4 }}>{dateLabel}</div>
        </div>
      </div>

      {/* V3: 録画モード選択ドロップダウン */}
      <div style={{ 
        marginTop: 16, 
        marginBottom: 16, 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12,
        padding: '0 4px'
      }}>
        <label style={{ 
          fontSize: 14, 
          fontWeight: 600, 
          color: '#b9b9b9',
          minWidth: 80
        }}>
          記録モード:
        </label>
        <select
          value={recordingMode}
          onChange={(e) => setRecordingMode(e.target.value as RecordingMode)}
          style={{
            flex: 1,
            height: 40,
            padding: '0 12px',
            borderRadius: 8,
            border: '1px solid #555',
            background: '#222',
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23999'%3E%3Cpath d='M6 9L1.5 4.5h9z'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center'
          }}
        >
          <option value="manual">手動記録</option>
          <option value="live">ライブ解析</option>
          <option value="upload">動画アップロード</option>
        </select>
      </div>

      {/* 各モードに応じたコンテンツ表示 */}
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

      {/* ライブ解析モード */}
      {recordingMode === 'live' && analysisStep === 'mode-selection' && (
        <div style={{ 
          marginTop: 32,
          textAlign: 'center',
          padding: '32px 16px',
          border: '2px dashed #555',
          borderRadius: 12,
          background: 'rgba(34, 34, 34, 0.5)'
        }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#0ea5e9', marginBottom: 12 }}>
            📹 ライブ解析モード
          </div>
          <div style={{ fontSize: 14, color: '#b9b9b9', marginBottom: 20, lineHeight: 1.5 }}>
            カメラを起動してリアルタイムで<br />
            シュートを自動解析・記録します
          </div>
          <button
            type="button"
            style={{
              padding: '12px 24px',
              borderRadius: 10,
              background: '#0ea5e9',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 16,
              WebkitTapHighlightColor: 'transparent',
              WebkitAppearance: 'none',
              touchAction: 'manipulation'
            }}
            onClick={() => setAnalysisStep('camera-recording')}
          >
            カメラを起動
          </button>
        </div>
      )}

      {/* 動画アップロードモード */}
      {recordingMode === 'upload' && analysisStep === 'mode-selection' && (
        <div style={{ 
          marginTop: 32,
          textAlign: 'center',
          padding: '32px 16px',
          border: '2px dashed #555',
          borderRadius: 12,
          background: 'rgba(34, 34, 34, 0.5)'
        }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#10b981', marginBottom: 12 }}>
            📁 動画アップロードモード
          </div>
          <div style={{ fontSize: 14, color: '#b9b9b9', marginBottom: 20, lineHeight: 1.5 }}>
            撮影済みの練習動画をアップロードして<br />
            自動解析・記録を行います
          </div>
          <button
            type="button"
            style={{
              padding: '12px 24px',
              borderRadius: 10,
              background: '#10b981',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 16,
              WebkitTapHighlightColor: 'transparent',
              WebkitAppearance: 'none',
              touchAction: 'manipulation'
            }}
            onClick={() => setAnalysisStep('video-upload')}
          >
            動画を選択
          </button>
        </div>
      )}

      {/* V3: ライブカメラ解析画面 */}
      {analysisStep === 'camera-recording' && (
        <LiveCameraAnalysis
          onRecordingComplete={handleLiveCameraComplete}
          onBack={resetAnalysisFlow}
        />
      )}

      {/* V3: 動画アップロード画面 */}
      {analysisStep === 'video-upload' && (
        <VideoUploadAnalysis
          onVideoSelected={handleVideoUploadSelected}
          onBack={resetAnalysisFlow}
        />
      )}

      {/* V3: 解析進捗画面 */}
      {analysisStep === 'analysis-progress' && (currentVideoBlob || currentVideoFile) && (
        <VideoAnalysisProgress
          videoBlob={currentVideoBlob || currentVideoFile!}
          onAnalysisComplete={handleAnalysisComplete}
          onBack={resetAnalysisFlow}
        />
      )}

      {/* V3: 解析結果レビュー画面 */}
      {analysisStep === 'results-review' && (
        <div style={{ 
          marginTop: 32,
          padding: '24px 16px',
          background: '#222',
          borderRadius: 12,
          color: '#fff'
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>
            🎯 解析完了！
          </h3>
          
          <div style={{ 
            background: '#10b981',
            color: '#fff',
            padding: 16,
            borderRadius: 8,
            textAlign: 'center',
            marginBottom: 20
          }}>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
              {detectedShots.length}個のシュートを検出
            </div>
            <div style={{ fontSize: 14, opacity: 0.9 }}>
              成功: {detectedShots.filter(s => s.result === 'make').length}回 / 
              失敗: {detectedShots.filter(s => s.result === 'miss').length}回
            </div>
          </div>

          <div style={{ 
            display: 'flex',
            gap: 12,
            marginTop: 20
          }}>
            <button
              onClick={() => {
                resetAnalysisFlow()
                setRecordingMode('manual')
              }}
              style={{
                flex: 1,
                padding: '12px 20px',
                borderRadius: 10,
                background: '#666',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              手動モードに戻る
            </button>
            <button
              onClick={resetAnalysisFlow}
              style={{
                flex: 1,
                padding: '12px 20px',
                borderRadius: 10,
                background: '#0ea5e9',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              新しい解析
            </button>
          </div>

          <div style={{ 
            marginTop: 16,
            padding: 12,
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: 8,
            fontSize: 12,
            color: '#10b981',
            textAlign: 'center'
          }}>
            ✅ シュートデータは自動でセッションに保存されました
          </div>
        </div>
      )}

      {/* 共通: End Session ボタン（V3機能用） */}
      {recordingMode !== 'manual' && analysisStep === 'mode-selection' && (
        <div style={{ 
          marginTop: 24, 
          textAlign: 'center'
        }}>
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