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
    console.log('カメラ起動を開始します...')
    setError(null)
    
    try {
      // まずカメラの権限があるかを確認
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('このブラウザはカメラ機能をサポートしていません。')
      }
      
      console.log('getUserMedia リクエストを送信中...')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: { ideal: 'environment' } // 背面カメラを優先（fallback対応）
        },
        audio: false // とりあえず音声は無しで試す
      })

      console.log('カメラストリームを取得しました:', stream)
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        
        // 動画が読み込まれたら再生開始
        videoRef.current.onloadedmetadata = () => {
          console.log('メタデータが読み込まれました。再生を開始します...')
          videoRef.current?.play().then(() => {
            console.log('動画の再生が開始されました')
            setIsStreamActive(true)
          }).catch((playError) => {
            console.error('動画再生エラー:', playError)
            setError('動画の再生に失敗しました。')
          })
        }
        
        // エラーハンドリング
        videoRef.current.onerror = (videoError) => {
          console.error('動画エラー:', videoError)
          setError('動画の表示中にエラーが発生しました。')
        }
      }
    } catch (err) {
      console.error('カメラアクセスエラー:', err)
      const error = err as DOMException
      if (error.name === 'NotAllowedError') {
        setError('カメラの使用が拒否されました。ブラウザの設定からカメラ権限を許可してください。')
      } else if (error.name === 'NotFoundError') {
        setError('カメラが見つかりません。デバイスにカメラが接続されていることを確認してください。')
      } else if (error.name === 'NotSupportedError') {
        setError('このブラウザではカメラ機能がサポートされていません。')
      } else {
        setError(`カメラアクセスに失敗しました: ${error.message || '不明なエラー'}`)
      }
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
            <div style={{ 
              flex: 1, 
              position: 'relative', 
              background: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
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
              
              {/* カメラ映像が表示されない場合の代替表示 */}
              {isStreamActive && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  color: '#fff',
                  textAlign: 'center',
                  fontSize: 14,
                  pointerEvents: 'none',
                  opacity: 0.7
                }}>
                  カメラ映像を読み込み中...
                </div>
              )}

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
                  top: 80, // 品質チェックオーバーレイの下に配置
                  right: 16,
                  background: '#ef4444',
                  color: '#fff',
                  padding: '8px 12px',
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
                }}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#fff',
                    animation: 'pulse 1s infinite'
                  }} />
                  録画中 {formatTime(recordingTime)}
                </div>
              )}
            </div>

            {/* コントロールエリア */}
            <div style={{
              padding: 24,
              background: '#222',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 24,
              borderTop: '1px solid #333'
            }}>
              {!isRecording ? (
                <>
                  <button
                    onClick={stopCamera}
                    style={{
                      padding: '14px 24px',
                      borderRadius: 12,
                      background: '#555',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 600,
                      fontSize: 15,
                      cursor: 'pointer',
                      WebkitTapHighlightColor: 'transparent'
                    }}
                  >
                    カメラ停止
                  </button>
                  <button
                    onClick={startRecording}
                    style={{
                      width: 84,
                      height: 84,
                      borderRadius: '50%',
                      background: '#ef4444',
                      border: '6px solid #fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 28,
                      fontWeight: 700,
                      WebkitTapHighlightColor: 'transparent',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}
                  >
                    ●
                  </button>
                  <div style={{ width: 100 }}></div> {/* スペーサー */}
                </>
              ) : (
                <>
                  <div style={{ width: 100 }}></div> {/* スペーサー */}
                  <button
                    onClick={stopRecording}
                    style={{
                      width: 84,
                      height: 84,
                      borderRadius: 16,
                      background: '#ef4444',
                      border: '6px solid #fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 32,
                      fontWeight: 700,
                      WebkitTapHighlightColor: 'transparent',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}
                  >
                    ■
                  </button>
                  <div style={{
                    color: '#fff',
                    fontSize: 16,
                    fontWeight: 600,
                    textAlign: 'center',
                    minWidth: 100
                  }}>
                    {formatTime(recordingTime)}
                  </div>
                </>
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