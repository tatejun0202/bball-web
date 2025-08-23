'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

interface QualityMetrics {
  goalDetected: boolean
  courtCoverage: number
  angleOptimal: boolean
  analysisAccuracy: number
}

interface LiveCameraAnalysisProps {
  onRecordingComplete: (videoBlob: Blob) => void
  onBack: () => void
}

export default function LiveCameraAnalysis({ onRecordingComplete, onBack }: LiveCameraAnalysisProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const [isStreamActive, setIsStreamActive] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics>({
    goalDetected: false,
    courtCoverage: 0,
    angleOptimal: false,
    analysisAccuracy: 0
  })
  const [error, setError] = useState<string | null>(null)

  // カメラ起動
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment' // 背面カメラを優先
        },
        audio: true
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setIsStreamActive(true)
        setError(null)
      }
    } catch (err) {
      setError('カメラアクセスに失敗しました。カメラの権限を確認してください。')
      console.error('Camera access error:', err)
    }
  }, [])

  // カメラ停止
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsStreamActive(false)
  }, [])

  // 録画開始
  const startRecording = useCallback(() => {
    if (!streamRef.current) return

    try {
      chunksRef.current = []
      const recorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm;codecs=vp8,opus'
      })

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        onRecordingComplete(blob)
      }

      recorder.start(1000) // 1秒ごとにデータを収集
      recorderRef.current = recorder
      setIsRecording(true)
      setRecordingTime(0)
    } catch (err) {
      setError('録画開始に失敗しました。')
      console.error('Recording start error:', err)
    }
  }, [onRecordingComplete])

  // 録画停止
  const stopRecording = useCallback(() => {
    if (recorderRef.current && isRecording) {
      recorderRef.current.stop()
      recorderRef.current = null
      setIsRecording(false)
    }
  }, [isRecording])

  // 録画時間の更新
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRecording])

  // リアルタイム品質チェック（模擬実装）
  useEffect(() => {
    if (!isStreamActive) return

    const interval = setInterval(() => {
      // 実際の実装では、フレーム解析を行う
      setQualityMetrics({
        goalDetected: Math.random() > 0.3, // 70%の確率でゴール検出
        courtCoverage: Math.floor(Math.random() * 40) + 60, // 60-100%
        angleOptimal: Math.random() > 0.4, // 60%の確率で最適角度
        analysisAccuracy: Math.floor(Math.random() * 20) + 75 // 75-95%
      })
    }, 2000)

    return () => clearInterval(interval)
  }, [isStreamActive])

  // コンポーネントのクリーンアップ
  useEffect(() => {
    return () => {
      stopCamera()
      if (recorderRef.current && isRecording) {
        recorderRef.current.stop()
      }
    }
  }, [stopCamera, isRecording])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      background: '#1a1a1a'
    }}>
      {/* ヘッダー */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        padding: '12px 16px',
        background: '#222',
        borderBottom: '1px solid #333'
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: '#0ea5e9',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent'
          }}
        >
          ← 戻る
        </button>
        <div style={{ 
          flex: 1, 
          textAlign: 'center', 
          fontSize: 18, 
          fontWeight: 700,
          color: '#fff'
        }}>
          📹 ライブ解析
        </div>
        {isRecording && (
          <div style={{
            color: '#ef4444',
            fontSize: 16,
            fontWeight: 600
          }}>
            REC {formatTime(recordingTime)}
          </div>
        )}
      </div>

      {/* エラー表示 */}
      {error && (
        <div style={{
          background: '#dc2626',
          color: '#fff',
          padding: '12px 16px',
          fontSize: 14,
          lineHeight: 1.4
        }}>
          {error}
        </div>
      )}

      {/* カメラビューエリア */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {!isStreamActive ? (
          // カメラ起動前画面
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📹</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
              カメラを起動してください
            </div>
            <div style={{ fontSize: 14, color: '#b9b9b9', marginBottom: 24, lineHeight: 1.5 }}>
              バスケットゴールとコートが映る位置に<br />
              デバイスを設置してください
            </div>
            <button
              onClick={startCamera}
              style={{
                padding: '16px 32px',
                borderRadius: 12,
                background: '#0ea5e9',
                color: '#fff',
                border: 'none',
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              カメラを起動
            </button>
          </div>
        ) : (
          // カメラ映像エリア
          <>
            <div style={{ flex: 1, position: 'relative', background: '#000' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />

              {/* 品質チェックオーバーレイ */}
              <div style={{
                position: 'absolute',
                top: 16,
                left: 16,
                right: 16,
                background: 'rgba(0, 0, 0, 0.8)',
                borderRadius: 8,
                padding: 12,
                color: '#fff',
                fontSize: 12
              }}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <QualityIndicator
                    label="ゴール検出"
                    status={qualityMetrics.goalDetected ? 'OK' : 'NG'}
                    color={qualityMetrics.goalDetected ? '#10b981' : '#ef4444'}
                  />
                  <QualityIndicator
                    label="コート範囲"
                    status={`${qualityMetrics.courtCoverage}%映っています`}
                    color={qualityMetrics.courtCoverage >= 80 ? '#10b981' : '#f59e0b'}
                  />
                  <QualityIndicator
                    label="撮影角度"
                    status={qualityMetrics.angleOptimal ? '最適' : '要調整'}
                    color={qualityMetrics.angleOptimal ? '#10b981' : '#f59e0b'}
                  />
                  <QualityIndicator
                    label="解析精度予測"
                    status={`${qualityMetrics.analysisAccuracy}%`}
                    color={qualityMetrics.analysisAccuracy >= 85 ? '#10b981' : '#f59e0b'}
                  />
                </div>
              </div>

              {/* 録画インジケーター */}
              {isRecording && (
                <div style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  background: '#ef4444',
                  color: '#fff',
                  padding: '6px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#fff',
                    animation: 'pulse 1s infinite'
                  }} />
                  録画中
                </div>
              )}
            </div>

            {/* コントロールエリア */}
            <div style={{
              padding: 20,
              background: '#222',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 20
            }}>
              {!isRecording ? (
                <>
                  <button
                    onClick={stopCamera}
                    style={{
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
                    カメラ停止
                  </button>
                  <button
                    onClick={startRecording}
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      background: '#ef4444',
                      border: '4px solid #fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 24,
                      WebkitTapHighlightColor: 'transparent'
                    }}
                  >
                    ●
                  </button>
                </>
              ) : (
                <button
                  onClick={stopRecording}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 12,
                    background: '#ef4444',
                    border: '4px solid #fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 24,
                    WebkitTapHighlightColor: 'transparent'
                  }}
                >
                  ■
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

function QualityIndicator({ 
  label, 
  status, 
  color 
}: { 
  label: string
  status: string 
  color: string 
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ minWidth: 80, fontSize: 11, opacity: 0.8 }}>{label}:</div>
      <div style={{ 
        color, 
        fontWeight: 600, 
        fontSize: 11 
      }}>
        {status}
      </div>
    </div>
  )
}