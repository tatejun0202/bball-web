'use client'
import { useState, useEffect } from 'react'

interface AnalysisStep {
  id: string
  label: string
  description: string
  completed: boolean
  current: boolean
}

interface ShotDetection {
  timestamp: number
  position: { x: number; y: number }
  result: 'make' | 'miss'
  confidence: number
}

interface VideoAnalysisProgressProps {
  videoBlob: Blob
  onAnalysisComplete: (results: ShotDetection[]) => void
  onBack: () => void
}

export default function VideoAnalysisProgress({ 
  videoBlob, 
  onAnalysisComplete, 
  onBack 
}: VideoAnalysisProgressProps) {
  const [progress, setProgress] = useState(0)
  const [estimatedTime, setEstimatedTime] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [detectedShots, setDetectedShots] = useState<ShotDetection[]>([])
  const [isCompleted, setIsCompleted] = useState(false)

  const analysisSteps: AnalysisStep[] = [
    {
      id: 'preprocessing',
      label: '前処理',
      description: '動画品質の確認と最適化',
      completed: false,
      current: false
    },
    {
      id: 'court-detection',
      label: 'コート認識',
      description: 'バスケットゴールとコートの検出',
      completed: false,
      current: false
    },
    {
      id: 'calibration',
      label: '自動キャリブレーション',
      description: '撮影角度の補正と座標系構築',
      completed: false,
      current: false
    },
    {
      id: 'frame-analysis',
      label: 'フレーム解析',
      description: 'ボール軌道とシュート動作の検出',
      completed: false,
      current: false
    },
    {
      id: 'result-analysis',
      label: '結果判定',
      description: 'シュートの成功・失敗判定',
      completed: false,
      current: false
    }
  ]

  const [steps, setSteps] = useState(analysisSteps)

  // 模擬解析プロセス
  useEffect(() => {
    const videoDuration = 300 // 5分の動画として仮定（秒）
    const totalEstimatedTime = Math.min(videoDuration * 0.1, 600) // 動画の10%の時間、最大10分
    setEstimatedTime(totalEstimatedTime)

    const progressTimer: NodeJS.Timeout | null = null
    const stepTimer: NodeJS.Timeout | null = null
    let elapsedTimer: NodeJS.Timeout | null = null

    const startAnalysis = async () => {
      // 経過時間の更新
      elapsedTimer = setInterval(() => {
        setElapsedTime(prev => prev + 1)
      }, 1000)

      // 各ステップの処理
      for (let i = 0; i < steps.length; i++) {
        setSteps(prev => prev.map((step, index) => ({
          ...step,
          current: index === i,
          completed: index < i
        })))

        // 各ステップの処理時間（模擬）
        const stepDuration = totalEstimatedTime / steps.length
        const stepProgressIncrement = 20 / steps.length // 各ステップで20%ずつ進捗

        for (let j = 0; j < stepDuration; j++) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          setProgress(prev => Math.min(prev + stepProgressIncrement / stepDuration, 100))

          // フレーム解析中にシュート検出の模擬（より多くのシュートを検出）
          if (i === 3) { // フレーム解析ステップでシュートを検出
            // 複数回チェックしてシュートを検出
            for (let shot = 0; shot < 3; shot++) {
              if (Math.random() > 0.3) { // 70%の確率でシュート検出
                const newShot: ShotDetection = {
                  timestamp: Math.random() * videoDuration,
                  position: {
                    x: Math.random() * 340,
                    y: Math.random() * 240
                  },
                  result: Math.random() > 0.4 ? 'make' : 'miss',
                  confidence: Math.random() * 20 + 75 // 75-95%
                }
                setDetectedShots(prev => [...prev, newShot])
              }
            }
          }
        }

        // ステップ完了
        setSteps(prev => prev.map((step, index) => ({
          ...step,
          completed: index <= i,
          current: false
        })))
      }

      // 解析完了
      setProgress(100)
      setIsCompleted(true)
      if (elapsedTimer) clearInterval(elapsedTimer)

      // 2秒後に結果を返す（現在のdetectedShotsを確実に渡す）
      setTimeout(() => {
        setDetectedShots(currentShots => {
          console.log('解析完了 - 検出されたシュート数:', currentShots.length, currentShots)
          onAnalysisComplete(currentShots)
          return currentShots
        })
      }, 2000)
    }

    startAnalysis()

    return () => {
      if (progressTimer) clearInterval(progressTimer)
      if (stepTimer) clearInterval(stepTimer)
      if (elapsedTimer) clearInterval(elapsedTimer)
    }
  }, [videoBlob, onAnalysisComplete, steps.length])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const remainingTime = Math.max(0, estimatedTime - elapsedTime)

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      background: '#1a1a1a',
      color: '#fff'
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
          disabled={!isCompleted}
          style={{
            background: 'none',
            border: 'none',
            color: isCompleted ? '#0ea5e9' : '#666',
            fontSize: 16,
            fontWeight: 600,
            cursor: isCompleted ? 'pointer' : 'not-allowed',
            WebkitTapHighlightColor: 'transparent'
          }}
        >
          ← 戻る
        </button>
        <div style={{ 
          flex: 1, 
          textAlign: 'center', 
          fontSize: 18, 
          fontWeight: 700
        }}>
          🔍 動画解析中
        </div>
      </div>

      <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column' }}>
        {/* プログレスバー */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 12
          }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              解析進捗: {Math.round(progress)}%
            </div>
            <div style={{ fontSize: 14, color: '#b9b9b9' }}>
              {isCompleted ? '完了' : `残り時間: ${formatTime(remainingTime)}`}
            </div>
          </div>
          
          <div style={{
            width: '100%',
            height: 8,
            background: '#333',
            borderRadius: 4,
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: isCompleted 
                ? '#10b981' 
                : 'linear-gradient(90deg, #0ea5e9, #3b82f6)',
              borderRadius: 4,
              transition: 'width 0.3s ease'
            }} />
          </div>

          <div style={{ 
            marginTop: 8,
            fontSize: 12,
            color: '#9aa',
            textAlign: 'center'
          }}>
            経過時間: {formatTime(elapsedTime)}
          </div>
        </div>

        {/* 処理ステップ */}
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            処理段階
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {steps.map((step, index) => (
              <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* ステータスアイコン */}
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  background: step.completed 
                    ? '#10b981' 
                    : step.current 
                      ? '#0ea5e9'
                      : '#333',
                  color: '#fff'
                }}>
                  {step.completed ? '✓' : step.current ? '...' : index + 1}
                </div>

                {/* ステップ情報 */}
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: 14, 
                    fontWeight: 600,
                    color: step.completed ? '#10b981' : step.current ? '#0ea5e9' : '#b9b9b9'
                  }}>
                    {step.label}
                  </div>
                  <div style={{ 
                    fontSize: 12, 
                    color: '#9aa',
                    marginTop: 2
                  }}>
                    {step.description}
                  </div>
                </div>

                {/* ローディングアニメーション */}
                {step.current && (
                  <div style={{
                    width: 20,
                    height: 20,
                    border: '2px solid #333',
                    borderTop: '2px solid #0ea5e9',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 検出されたシュート */}
        {detectedShots.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
              検出シュート数: {detectedShots.length}
            </h3>
            <div style={{ 
              background: '#222',
              borderRadius: 8,
              padding: 16,
              maxHeight: 200,
              overflowY: 'auto'
            }}>
              {detectedShots.map((shot, index) => (
                <div key={index} style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 0',
                  borderBottom: index < detectedShots.length - 1 ? '1px solid #333' : 'none'
                }}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: shot.result === 'make' ? '#10b981' : '#ef4444'
                  }} />
                  <div style={{ flex: 1, fontSize: 12 }}>
                    {formatTime(Math.floor(shot.timestamp))} - 
                    {shot.result === 'make' ? ' 成功' : ' 失敗'} 
                    (精度: {Math.round(shot.confidence)}%)
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 完了メッセージ */}
        {isCompleted && (
          <div style={{
            background: '#10b981',
            color: '#fff',
            padding: 16,
            borderRadius: 8,
            textAlign: 'center',
            fontSize: 14,
            fontWeight: 600
          }}>
            ✅ 解析が完了しました！{detectedShots.length}個のシュートを検出
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}