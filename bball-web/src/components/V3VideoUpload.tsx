'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { ShotAnalyzer } from '@/ai/shot-analyzer'
import type { ShotEvent } from '@/ai/types'

interface VideoQualityCheck {
  duration: number
  resolution: { width: number; height: number }
  hasAudio: boolean
  estimatedAnalysisTime: number
  qualityScore: number
  fileSize: number
}

interface V3VideoUploadProps {
  onVideoSelected: (file: File, qualityCheck: VideoQualityCheck, shots: ShotEvent[]) => void
  onBack: () => void
}

export default function V3VideoUpload({ onVideoSelected, onBack }: V3VideoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoPreviewRef = useRef<HTMLVideoElement>(null)
  const analyzerRef = useRef<ShotAnalyzer | null>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [qualityCheck, setQualityCheck] = useState<VideoQualityCheck | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isAnalyzerReady, setIsAnalyzerReady] = useState(false)

  // TensorFlow.js解析エンジンの初期化
  const initializeAnalyzer = useCallback(async () => {
    try {
      console.log('AI解析エンジンを初期化中...')
      const analyzer = new ShotAnalyzer({
        frameRate: 30,
        analysisFrameRate: 5, // アップロード動画では5fpsで解析
        ballConfidenceThreshold: 0.3,
        trajectoryHistorySeconds: 4
      })
      
      await analyzer.initialize()
      analyzerRef.current = analyzer
      setIsAnalyzerReady(true)
      console.log('AI解析エンジンが初期化されました')
    } catch (error) {
      console.error('AI解析エンジンの初期化に失敗:', error)
      setError('AI解析エンジンの読み込みに失敗しました')
    }
  }, [])

  // ファイル選択処理（非同期で品質チェック）
  const handleFileSelect = useCallback(async (file: File) => {
    setError(null)
    setSelectedFile(file)
    
    // プレビューURL作成
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)

    // 品質チェックを非同期で実行（UIをブロックしない）
    setTimeout(async () => {
      try {
        const quality = await performQualityCheck(file, url)
        setQualityCheck(quality)
      } catch (err) {
        setError('動画の品質チェックに失敗しました')
        console.error('Quality check error:', err)
      }
    }, 100) // 100ms後に実行してUIの応答性を保つ
  }, [previewUrl])

  // 品質チェック実行
  const performQualityCheck = (file: File, videoUrl: string): Promise<VideoQualityCheck> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      
      video.onloadedmetadata = () => {
        const duration = video.duration
        const width = video.videoWidth
        const height = video.videoHeight
        
        // 品質スコア計算
        const resolutionScore = Math.min(100, (width * height) / (1280 * 720) * 100)
        const durationScore = duration >= 10 && duration <= 300 ? 100 : Math.max(0, 100 - Math.abs(duration - 60))
        const qualityScore = Math.round((resolutionScore + durationScore) / 2)
        
        // 解析時間予測（秒数の1/3程度）
        const estimatedAnalysisTime = Math.max(10, Math.round(duration / 3))

        resolve({
          duration,
          resolution: { width, height },
          hasAudio: false, // Web APIでは正確な音声検出が困難
          estimatedAnalysisTime,
          qualityScore,
          fileSize: file.size
        })
      }
      
      video.onerror = () => reject(new Error('動画の読み込みに失敗しました'))
      video.src = videoUrl
    })
  }

  // AI解析実行
  const performAnalysis = async () => {
    if (!selectedFile || !analyzerRef.current || !videoPreviewRef.current) {
      setError('解析の準備ができていません')
      return
    }

    setIsAnalyzing(true)
    setAnalysisProgress(0)
    setError(null)

    try {
      console.log('AI解析を開始します...')
      
      const result = await analyzerRef.current.analyzeVideoProgressive(
        videoPreviewRef.current,
        (progress, stage) => {
          setAnalysisProgress(Math.round(progress * 100))
          console.log(`解析進捗: ${Math.round(progress * 100)}% - ${stage}`)
        }
      )

      console.log(`解析完了: ${result.shots.length}個のシュートを検出`)
      
      if (qualityCheck) {
        onVideoSelected(selectedFile, qualityCheck, result.shots)
      }

    } catch (error) {
      console.error('AI解析エラー:', error)
      setError('AI解析中にエラーが発生しました')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)}KB`
    }
    return `${Math.round(bytes / (1024 * 1024))}MB`
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // コンポーネント初期化時にAI解析エンジンを読み込み
  useEffect(() => {
    initializeAnalyzer()
    return () => {
      if (analyzerRef.current) {
        analyzerRef.current.dispose()
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [])

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
            cursor: 'pointer'
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
          📁 AI動画解析 {!isAnalyzerReady && '(読み込み中...)'}
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div style={{
          background: '#dc2626',
          color: '#fff',
          padding: '12px 16px',
          fontSize: 14
        }}>
          {error}
        </div>
      )}

      <div style={{ flex: 1, padding: 16 }}>
        {!selectedFile ? (
          /* ファイル選択画面 */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 64, marginBottom: 24 }}>🤖</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#fff', marginBottom: 12 }}>
              AI動画解析
            </div>
            <div style={{ fontSize: 14, color: '#b9b9b9', marginBottom: 32, lineHeight: 1.5 }}>
              TensorFlow.jsがバスケット動画を解析し<br />
              シュートを自動検出・記録します
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
              onChange={async (e) => {
                try {
                  const file = e.target.files?.[0]
                  if (file) {
                    console.log('ファイル選択:', file.name, file.size, file.type)
                    await handleFileSelect(file)
                  }
                  // ファイル選択後はinputをリセット（同じファイルでも再選択可能に）
                  e.target.value = ''
                } catch (error) {
                  console.error('ファイル選択エラー:', error)
                  setError('ファイルの読み込みに失敗しました')
                }
              }}
              style={{ display: 'none' }}
            />
            
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
              disabled={!isAnalyzerReady}
              style={{
                padding: '16px 32px',
                borderRadius: 12,
                background: isAnalyzerReady ? '#0ea5e9' : '#555',
                color: '#fff',
                border: 'none',
                fontSize: 16,
                fontWeight: 700,
                cursor: isAnalyzerReady ? 'pointer' : 'not-allowed',
                marginBottom: 16,
                touchAction: 'manipulation', // iOS Safariでのタップ遅延を削除
                WebkitTapHighlightColor: 'transparent',
                WebkitAppearance: 'none'
              }}
            >
              {isAnalyzerReady ? '動画を選択' : 'AI読み込み中...'}
            </button>
            
            <div style={{ fontSize: 12, color: '#666' }}>
              対応形式: MP4, WebM, MOV<br />
              推奨: 10秒〜5分の動画
            </div>
          </div>
        ) : (
          /* 動画プレビュー・解析画面 */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* 動画プレビュー */}
            <div style={{ 
              flex: 1, 
              background: '#000', 
              borderRadius: 8, 
              overflow: 'hidden',
              marginBottom: 16,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {previewUrl && (
                <video
                  ref={videoPreviewRef}
                  src={previewUrl}
                  controls
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                  }}
                />
              )}
              
              {/* 解析進捗オーバーレイ */}
              {isAnalyzing && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0, 0, 0, 0.8)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff'
                }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
                  <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                    AI解析中...
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
                    {analysisProgress}%
                  </div>
                  <div style={{ 
                    width: '200px', 
                    height: '4px', 
                    background: '#333', 
                    borderRadius: '2px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${analysisProgress}%`,
                      height: '100%',
                      background: '#0ea5e9',
                      transition: 'width 0.3s'
                    }} />
                  </div>
                </div>
              )}
            </div>

            {/* 品質情報 */}
            {qualityCheck && (
              <div style={{
                background: '#222',
                borderRadius: 8,
                padding: 16,
                marginBottom: 16,
                color: '#fff'
              }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
                  📊 動画品質チェック
                </div>
                <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
                  <QualityItem 
                    label="再生時間" 
                    value={formatTime(qualityCheck.duration)}
                    status={qualityCheck.duration >= 10 && qualityCheck.duration <= 300 ? 'good' : 'warning'}
                  />
                  <QualityItem 
                    label="解像度" 
                    value={`${qualityCheck.resolution.width}×${qualityCheck.resolution.height}`}
                    status={qualityCheck.resolution.width >= 720 ? 'good' : 'warning'}
                  />
                  <QualityItem 
                    label="ファイルサイズ" 
                    value={formatFileSize(qualityCheck.fileSize)}
                    status={qualityCheck.fileSize <= 100 * 1024 * 1024 ? 'good' : 'warning'}
                  />
                  <QualityItem 
                    label="予想解析時間" 
                    value={`約${qualityCheck.estimatedAnalysisTime}秒`}
                    status="info"
                  />
                  <QualityItem 
                    label="品質スコア" 
                    value={`${qualityCheck.qualityScore}/100`}
                    status={qualityCheck.qualityScore >= 70 ? 'good' : 'warning'}
                  />
                </div>
              </div>
            )}

            {/* アクションボタン */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => {
                  setSelectedFile(null)
                  setQualityCheck(null)
                  if (previewUrl) {
                    URL.revokeObjectURL(previewUrl)
                    setPreviewUrl(null)
                  }
                }}
                disabled={isAnalyzing}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: 12,
                  background: '#555',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                  opacity: isAnalyzing ? 0.5 : 1
                }}
              >
                別の動画を選択
              </button>
              <button
                onClick={performAnalysis}
                disabled={!qualityCheck || isAnalyzing || !isAnalyzerReady}
                style={{
                  flex: 2,
                  padding: '14px',
                  borderRadius: 12,
                  background: qualityCheck && isAnalyzerReady && !isAnalyzing ? '#0ea5e9' : '#555',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  cursor: qualityCheck && isAnalyzerReady && !isAnalyzing ? 'pointer' : 'not-allowed'
                }}
              >
                {isAnalyzing ? `解析中... ${analysisProgress}%` : 
                 !isAnalyzerReady ? 'AI読み込み中...' : 
                 'AI解析を開始'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function QualityItem({ 
  label, 
  value, 
  status 
}: { 
  label: string
  value: string
  status: 'good' | 'warning' | 'info'
}) {
  const statusColor = {
    good: '#10b981',
    warning: '#f59e0b',
    info: '#3b82f6'
  }[status]

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ opacity: 0.8 }}>{label}:</span>
      <span style={{ color: statusColor, fontWeight: 600 }}>{value}</span>
    </div>
  )
}