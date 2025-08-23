'use client'
import { useState, useRef, useCallback } from 'react'

interface VideoQualityCheck {
  duration: number
  resolution: { width: number; height: number }
  hasAudio: boolean
  estimatedAnalysisTime: number
  qualityScore: number
}

interface VideoUploadAnalysisProps {
  onVideoSelected: (file: File, qualityCheck: VideoQualityCheck) => void
  onBack: () => void
}

export default function VideoUploadAnalysis({ onVideoSelected, onBack }: VideoUploadAnalysisProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [qualityCheck, setQualityCheck] = useState<VideoQualityCheck | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ファイル選択
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('video/')) {
      setError('動画ファイルを選択してください（MP4, MOV, WebM対応）')
      return
    }

    if (file.size > 1.5 * 1024 * 1024 * 1024) { // 1.5GB制限
      setError('ファイルサイズが大きすぎます（最大1.5GB）')
      return
    }

    setSelectedFile(file)
    setError(null)
    analyzeVideo(file)
  }, [])

  // 動画品質解析
  const analyzeVideo = useCallback(async (file: File) => {
    setIsAnalyzing(true)
    
    try {
      const videoUrl = URL.createObjectURL(file)
      const video = document.createElement('video')
      
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve
        video.onerror = reject
        video.src = videoUrl
      })

      // 動画情報の取得
      const duration = video.duration
      const width = video.videoWidth
      const height = video.videoHeight

      // 品質スコアの計算（模擬）
      let qualityScore = 100
      
      // 解像度チェック
      if (width < 720 || height < 480) {
        qualityScore -= 20
      }
      
      // アスペクト比チェック
      const aspectRatio = width / height
      if (aspectRatio < 1.2 || aspectRatio > 2.0) {
        qualityScore -= 10
      }
      
      // 長さチェック
      if (duration < 60) { // 1分未満
        qualityScore -= 15
      } else if (duration > 3600) { // 1時間超
        qualityScore -= 5
      }

      // 推定解析時間（動画の5-15%）
      const analysisTimeRatio = duration > 1800 ? 0.05 : 0.15 // 30分超なら5%、以下なら15%
      const estimatedAnalysisTime = Math.ceil(duration * analysisTimeRatio)

      const check: VideoQualityCheck = {
        duration,
        resolution: { width, height },
        hasAudio: true, // 簡略化
        estimatedAnalysisTime,
        qualityScore: Math.max(qualityScore, 60) // 最低60点
      }

      setQualityCheck(check)
      URL.revokeObjectURL(videoUrl)
      
      // プレビュー表示用にvideoRefに設定
      if (videoRef.current) {
        videoRef.current.src = URL.createObjectURL(file)
      }
      
    } catch (err) {
      setError('動画ファイルの解析に失敗しました。ファイルが破損している可能性があります。')
      console.error('Video analysis error:', err)
    } finally {
      setIsAnalyzing(false)
    }
  }, [])

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getQualityColor = (score: number) => {
    if (score >= 85) return '#10b981'
    if (score >= 70) return '#f59e0b'
    return '#ef4444'
  }

  const getQualityText = (score: number) => {
    if (score >= 85) return '優秀'
    if (score >= 70) return '良好'
    return '要改善'
  }

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
          fontWeight: 700
        }}>
          📁 動画アップロード
        </div>
      </div>

      <div style={{ flex: 1, padding: 24 }}>
        {/* エラー表示 */}
        {error && (
          <div style={{
            background: '#dc2626',
            color: '#fff',
            padding: '12px 16px',
            borderRadius: 8,
            fontSize: 14,
            marginBottom: 20
          }}>
            {error}
          </div>
        )}

        {!selectedFile ? (
          // ファイル選択エリア
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed #555',
              borderRadius: 12,
              padding: 40,
              textAlign: 'center',
              cursor: 'pointer',
              background: 'rgba(34, 34, 34, 0.5)',
              transition: 'border-color 0.2s ease'
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.currentTarget.style.borderColor = '#0ea5e9'
            }}
            onDragLeave={(e) => {
              e.currentTarget.style.borderColor = '#555'
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.currentTarget.style.borderColor = '#555'
              const files = Array.from(e.dataTransfer.files)
              if (files.length > 0) {
                handleFileSelect(files[0])
              }
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              動画ファイルを選択
            </div>
            <div style={{ fontSize: 14, color: '#b9b9b9', marginBottom: 16, lineHeight: 1.5 }}>
              クリックまたはドラッグ＆ドロップ<br />
              対応形式: MP4, MOV, WebM（最大1.5GB）
            </div>
            <button
              style={{
                padding: '12px 24px',
                borderRadius: 10,
                background: '#0ea5e9',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              ファイルを選択
            </button>
          </div>
        ) : (
          // 選択されたファイルの情報表示
          <div>
            {/* ファイル情報 */}
            <div style={{
              background: '#222',
              borderRadius: 12,
              padding: 20,
              marginBottom: 20
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                ファイル情報
              </h3>
              <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#b9b9b9' }}>ファイル名:</span>
                  <span>{selectedFile.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#b9b9b9' }}>ファイルサイズ:</span>
                  <span>{formatFileSize(selectedFile.size)}</span>
                </div>
                {qualityCheck && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#b9b9b9' }}>動画長:</span>
                      <span>{formatDuration(qualityCheck.duration)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#b9b9b9' }}>解像度:</span>
                      <span>{qualityCheck.resolution.width} × {qualityCheck.resolution.height}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 品質チェック結果 */}
            {isAnalyzing ? (
              <div style={{
                background: '#222',
                borderRadius: 12,
                padding: 20,
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  動画を解析中...
                </div>
                <div style={{
                  width: 40,
                  height: 40,
                  border: '4px solid #333',
                  borderTop: '4px solid #0ea5e9',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '16px auto'
                }} />
              </div>
            ) : qualityCheck ? (
              <div style={{
                background: '#222',
                borderRadius: 12,
                padding: 20,
                marginBottom: 20
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                  品質チェック結果
                </h3>
                
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 14, color: '#b9b9b9' }}>総合品質スコア:</span>
                    <span style={{ 
                      fontSize: 16, 
                      fontWeight: 700,
                      color: getQualityColor(qualityCheck.qualityScore)
                    }}>
                      {qualityCheck.qualityScore}点 ({getQualityText(qualityCheck.qualityScore)})
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, color: '#b9b9b9' }}>推定解析時間:</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>
                      約{formatDuration(qualityCheck.estimatedAnalysisTime)}
                    </span>
                  </div>
                </div>

                {/* 品質改善提案 */}
                {qualityCheck.qualityScore < 85 && (
                  <div style={{
                    background: '#f59e0b',
                    color: '#fff',
                    padding: 12,
                    borderRadius: 8,
                    fontSize: 12,
                    marginBottom: 16
                  }}>
                    <strong>💡 品質向上のヒント:</strong>
                    <div style={{ marginTop: 4, lineHeight: 1.4 }}>
                      {qualityCheck.resolution.width < 720 && '• より高解像度での撮影を推奨します'}
                      {qualityCheck.duration < 60 && '• より長時間の撮影でより多くのシュートを記録できます'}
                    </div>
                  </div>
                )}

                {/* 動画プレビュー */}
                <div style={{ marginBottom: 16 }}>
                  <video
                    ref={videoRef}
                    controls
                    style={{
                      width: '100%',
                      maxHeight: 200,
                      borderRadius: 8,
                      background: '#000'
                    }}
                  />
                </div>
              </div>
            ) : null}

            {/* アクションボタン */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => {
                  setSelectedFile(null)
                  setQualityCheck(null)
                  setError(null)
                  if (videoRef.current) {
                    videoRef.current.src = ''
                  }
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
                別ファイルを選択
              </button>
              
              {qualityCheck && (
                <button
                  onClick={() => onVideoSelected(selectedFile, qualityCheck)}
                  style={{
                    flex: 2,
                    padding: '12px 20px',
                    borderRadius: 10,
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                >
                  解析を開始
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ファイル選択用のhidden input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            handleFileSelect(file)
          }
        }}
      />

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}