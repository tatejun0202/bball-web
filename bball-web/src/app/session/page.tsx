// src/app/session/page.tsx (V3版 - カメラ録画機能統合)
'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useHorizontalSwipe } from '@/hooks/useHorizontalSwipe'
import FreePositionCourt from '@/components/FreePositionCourt'
// import LiveCameraAnalysis from '@/components/LiveCameraAnalysis'
import V3VideoUpload from '@/components/V3VideoUpload'
// import VideoUploadAnalysis from '@/components/VideoUploadAnalysis'
import VideoAnalysisProgress from '@/components/VideoAnalysisProgress'
import styles from './session.module.css'
import { 
  getOrCreateActiveSession, 
  getSession, 
  updateSessionTitle, 
  ensureSeedZones,
  listZones,
  listSessions,
  endSession,
  updateSessionMins
} from '@/db/repositories'
import { addDrillResultV2 } from '@/db/repositories-v2'
import { detectArea } from '@/constants/court-areas'
import { SPOTS } from '@/constants/spots'
import type { Zone } from '@/db/dexie'
import type { NewDrillResult, PositionInfo } from '@/db/types'
import type { ShotEvent } from '@/ai/types'

// 文字列から数値への変換（空文字は0）
const toInt = (s: string) => (s === '' ? 0 : parseInt(s, 10))

// 数値文字列の正規化（不正な文字を除去）
const normalizeNumString = (s: string) => s.replace(/[^\d]/g, '')

// モードの型定義
type RecordingMode = 'manual' | 'upload'
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
  // const [videoQualityCheck, setVideoQualityCheck] = useState<VideoQualityCheck | null>(null)
  const [detectedShots, setDetectedShots] = useState<ShotDetection[]>([])
  // const [isAnalysisComplete, setIsAnalysisComplete] = useState(false)
  
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

  // V3: ライブカメラ録画完了の処理（AI解析版）
  const handleV3LiveComplete = async (videoBlob: Blob, shots: ShotEvent[]) => {
    // 新しいセッションを作成
    const newSessionId = await createNewSessionForRecording('AI ライブ録画')
    setCurrentVideoBlob(videoBlob)
    // AI解析結果を直接処理
    await handleAnalysisComplete(shots)
  }

  // V3: 動画アップロード解析完了の処理（AI解析版）
  const handleV3UploadComplete = async (file: File, qualityCheck: VideoQualityCheck, shots: ShotEvent[]) => {
    // 新しいセッションを作成
    const newSessionId = await createNewSessionForRecording(`AI 動画解析: ${file.name}`)
    setCurrentVideoFile(file)
    // setVideoQualityCheck(qualityCheck)
    
    // 動画時間（分）を計算して設定
    const durationInMinutes = Math.ceil(qualityCheck.duration / 60)
    if (newSessionId) {
      await updateSessionMins(newSessionId, durationInMinutes)
    }
    
    // AI解析結果を直接処理
    await handleAnalysisComplete(shots)
    
    // セッション自動終了と履歴画面遷移
    if (newSessionId) {
      await endSession(newSessionId)
      router.replace('/history')
    }
  }

  // V3: ライブカメラ録画完了の処理（従来版）
  // const handleLiveCameraComplete = async (videoBlob: Blob) => {
  //   // 新しいセッションを作成
  //   await createNewSessionForRecording('ライブ録画')
  //   setCurrentVideoBlob(videoBlob)
  //   setAnalysisStep('analysis-progress')
  // }

  // V3: 動画アップロード選択の処理（従来版）
  // const handleVideoUploadSelected = async (file: File, qualityCheck: VideoQualityCheck) => {
  //   // 新しいセッションを作成
  //   await createNewSessionForRecording(`動画アップロード: ${file.name}`)
  //   setCurrentVideoFile(file)
  //   setVideoQualityCheck(qualityCheck)
  //   setAnalysisStep('analysis-progress')
  // }

  // V3: 録画・動画用の新セッション作成
  const createNewSessionForRecording = async (sessionName: string): Promise<number | null> => {
    try {
      // 現在のセッションを終了
      if (sessionId) {
        await endSession(sessionId)
      }
      
      // 新しいセッションを作成
      const newSessionId = await getOrCreateActiveSession()
      setSessionId(newSessionId)
      
      // セッション数を取得して新しいタイトルを生成
      const sessions = await listSessions()
      const sessionCount = sessions.length
      const newTitle = `${sessionName} - Session${sessionCount}`
      setTitle(newTitle)
      
      // データベースに保存
      await updateSessionTitle(newSessionId, newTitle)
      
      console.log(`新しいセッションを作成しました: ${newTitle} (ID: ${newSessionId})`)
      return newSessionId
    } catch (error) {
      console.error('セッション作成エラー:', error)
      return null
    }
  }

  // V3: 解析完了時の処理
  const handleAnalysisComplete = async (shots: ShotEvent[] | ShotDetection[]) => {
    // ShotEventをShotDetectionに変換
    const convertedShots: ShotDetection[] = shots.map(shot => {
      if ('outcome' in shot) {
        // ShotEvent型の場合
        const shotEvent = shot as ShotEvent
        return {
          timestamp: shotEvent.startTime,
          position: {
            x: shotEvent.peak?.x || shotEvent.trajectory[0]?.position.x || 0,
            y: shotEvent.peak?.y || shotEvent.trajectory[0]?.position.y || 0
          },
          result: shotEvent.outcome === 'made' ? 'make' as const : 'miss' as const,
          confidence: shotEvent.confidence
        }
      } else {
        // 既にShotDetection型の場合
        return shot as ShotDetection
      }
    }).filter(shot => shot.result !== ('unknown' as 'make' | 'miss')) // unknown結果を除外

    setDetectedShots(convertedShots)
    // setIsAnalysisComplete(true)
    
    // 検出されたシュートをV2システムに保存
    if (sessionId && convertedShots.length > 0) {
      for (const shot of convertedShots) {
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
    // setVideoQualityCheck(null)
    setDetectedShots([])
    // setIsAnalysisComplete(false)
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

  // V3: フルスクリーンモードかどうかの判定
  const isFullScreenMode = analysisStep !== 'mode-selection'

  if (isFullScreenMode) {
    // フルスクリーンモード（カメラ、アップロード、解析画面）
    return (
      <div className={styles.fullScreenMode}>

        {/* V3: 動画アップロード画面 */}
        {analysisStep === 'video-upload' && (
          <V3VideoUpload
            onVideoSelected={handleV3UploadComplete}
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
          <div className={styles.resultsContainer}>
            <div className={styles.resultsContent}>
              <h3 className={styles.resultsTitle}>
                🎯 解析完了！
              </h3>
              
              <div className={styles.resultsStats}>
                <div className={styles.resultsStatsMain}>
                  {detectedShots.length}個のシュートを検出
                </div>
                <div className={styles.resultsStatsSub}>
                  成功: {detectedShots.filter(s => s.result === 'make').length}回 / 
                  失敗: {detectedShots.filter(s => s.result === 'miss').length}回
                </div>
              </div>

              <div className={styles.resultsSessionInfo}>
                <div className={styles.resultsSessionTitle}>
                  📊 セッション: {title}
                </div>
                <div className={styles.resultsSessionSubtitle}>
                  新しいセッションとして保存されました
                </div>
              </div>

              <div className={styles.resultsButtonRow}>
                <button
                  onClick={() => {
                    if (sessionId) {
                      router.push(`/result/${sessionId}`)
                    }
                  }}
                  className={`${styles.primaryButton} ${styles.primaryButtonEnabled}`}
                >
                  結果を見る
                </button>
                <button
                  onClick={async () => {
                    resetAnalysisFlow()
                    setRecordingMode('manual')
                    // 解析完了後は新しい手動セッションに切り替える
                    await createNewSessionForRecording('手動記録')
                  }}
                  className={styles.secondaryButton}
                >
                  手動モードに戻る
                </button>
              </div>

              <div className={styles.resultsFinalMessage}>
                ✅ シュートデータは自動でセッションに保存されました
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // 通常モード（モード選択画面）
  return (
    <main className={`page-fit ${styles.pageContainer}`}>
      {/* タイトル行（ペンで編集） */}
      <div className={styles.titleSection}>
        <div>
          {editingTitle ? (
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={e => { if (e.key === 'Enter') commitTitle() }}
              autoFocus
              className={styles.titleInput}
            />
          ) : (
            <div className={styles.titleContainer}>
              <div className={styles.titleText}>{title}</div>
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                aria-label="edit title"
                className={styles.editButton}
              >✏️</button>
            </div>
          )}
          <div className={styles.dateLabel}>{dateLabel}</div>
        </div>
      </div>

      {/* V3: 録画モード選択ドロップダウン */}
      <div className={styles.modeSelection}>
        <label className={styles.modeLabel}>
          記録モード:
        </label>
        <select
          value={recordingMode}
          onChange={(e) => setRecordingMode(e.target.value as RecordingMode)}
          className={styles.modeSelect}
        >
          <option value="manual">手動記録</option>
          <option value="upload">動画アップロード</option>
        </select>
      </div>

      {/* 各モードに応じたコンテンツ表示 */}
      {recordingMode === 'manual' && (
        <div className={styles.manualModeContainer}>
          {/* コート */}
          <div className={styles.courtContainer}>
            <div className={styles.courtWrapper}>
              {/* トグルボタン（コート右上外側） */}
              <div className={styles.toggleContainer}>
                <span className={showFixedSpots ? styles.toggleTextActive : styles.toggleText}>
                  Spot Mode
                </span>
                <button
                  type="button"
                  aria-label="スポットモード切り替え"
                  onClick={handleSpotModeToggle}
                  className={`${styles.toggleButton} ${showFixedSpots ? styles.toggleButtonActive : ''}`}
                >
                  <div className={`${styles.toggleHandle} ${showFixedSpots ? styles.toggleHandleActive : ''}`} />
                </button>
              </div>
              
              <FreePositionCourt
                width={typeof window !== 'undefined' ? Math.min(340, window.innerWidth - 40) : 340}
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
          <div className={styles.inputSection}>
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
          <div className={styles.buttonSection}>
            <button
              type="button"
              disabled={!canSave}
              onClick={save}
              className={`${styles.primaryButton} ${canSave ? styles.primaryButtonEnabled : styles.primaryButtonDisabled}`}
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
              className={styles.secondaryButton}
            >
              End Session
            </button>
          </div>
        </div>
      )}


      {/* 動画アップロードモード */}
      {recordingMode === 'upload' && analysisStep === 'mode-selection' && (
        <div className={styles.modeCard}>
          <div className={`${styles.modeCardTitle} ${styles.modeCardTitleUpload}`}>
            📁 動画アップロードモード
          </div>
          <div className={styles.modeCardDescription}>
            撮影済みの練習動画をアップロードして<br />
            自動解析・記録を行います
          </div>
          <button
            type="button"
            className={`${styles.modeCardButton} ${styles.modeCardButtonUpload}`}
            onClick={() => setAnalysisStep('video-upload')}
          >
            動画を選択
          </button>
        </div>
      )}

      {/* 共通: End Session ボタン（V3機能用） */}
      {recordingMode !== 'manual' && analysisStep === 'mode-selection' && (
        <div className={styles.buttonSection}>
          <button
            type="button"
            disabled={!sessionId}
            onClick={async () => {
              if (!sessionId) return
              await endSession(sessionId)
              router.replace('/history')
            }}
            className={styles.secondaryButton}
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
    <div className={styles.inputRow}>
      <div className={styles.inputLabel}>{label}</div>
      <input
        type="text"
        inputMode="numeric"
        pattern="\d*"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={styles.inputField}
      />
      <button type="button" onClick={onMinus} className={styles.inputButton}>
        －
      </button>
      <button type="button" onClick={onPlus} className={styles.inputButton}>
        ＋
      </button>
    </div>
  )
}