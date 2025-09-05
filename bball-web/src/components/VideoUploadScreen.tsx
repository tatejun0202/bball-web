// src/components/VideoUploadScreen.tsx
'use client'
import { useState, useRef } from 'react'
import { VideoPreprocessor, PreprocessingProgress, PreprocessingResult } from '@/utils/videoPreprocessor'

interface VideoUploadScreenProps {
  onUploadComplete: (result: PreprocessingResult) => void
  onBack: () => void
}

type UploadStage = 'select' | 'preprocessing' | 'uploading' | 'analyzing' | 'complete'

export default function VideoUploadScreen({ onUploadComplete, onBack }: VideoUploadScreenProps) {
  const [stage, setStage] = useState<UploadStage>('select')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<PreprocessingProgress>({ stage: 'initializing', progress: 0 })
  const [error, setError] = useState<string | null>(null)
  const [videoMetadata, setVideoMetadata] = useState<{
    duration: number
    width: number
    height: number
    size: number
    type: string
  } | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const preprocessor = useRef(new VideoPreprocessor())

  const handleFileSelect = async (file: File) => {
    // ファイルバリデーション
    const validation = VideoPreprocessor.validateVideoFile(file)
    if (!validation.valid) {
      setError(validation.error!)
      return
    }

    try {
      // メタデータ取得
      const metadata = await VideoPreprocessor.getVideoMetadata(file)
      
      // 20分制限チェック
      if (metadata.duration > 1200) {
        setError('動画の長さが20分を超えています')
        return
      }

      setSelectedFile(file)
      setVideoMetadata(metadata)
      setError(null)
    } catch {
      setError('動画ファイルの読み込みに失敗しました')
    }
  }

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const startPreprocessing = async () => {
    if (!selectedFile) return

    setStage('preprocessing')
    setError(null)

    try {
      const result = await preprocessor.current.processVideoLightweight(
        selectedFile,
        {
          targetWidth: 480,
          targetHeight: 270,
          targetFps: 2,
          quality: 0.7
        },
        (progressData) => {
          setProgress(progressData)
        }
      )

      setStage('complete')
      onUploadComplete(result)

    } catch (processingError) {
      setError(processingError instanceof Error ? processingError.message : '動画の処理に失敗しました')
      setStage('select')
    }
  }

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)}MB`
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  if (stage === 'preprocessing') {
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
          <div style={{ fontSize: 48, marginBottom: 24 }}>⚡</div>
          <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>
            動画を処理中...
          </div>
          <div style={{ color: '#9aa', marginBottom: 32 }}>
            {progress.stage === 'initializing' && '初期化中...'}
            {progress.stage === 'extracting' && 'フレームを抽出中...'}
            {progress.stage === 'encoding' && 'データを圧縮中...'}
          </div>

          {/* プログレスバー */}
          <div style={{
            width: '100%',
            height: 8,
            background: '#333',
            borderRadius: 4,
            marginBottom: 16,
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress.progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #0ea5e9, #06b6d4)',
              borderRadius: 4,
              transition: 'width 0.3s ease'
            }} />
          </div>

          <div style={{ color: '#9aa', fontSize: 14 }}>
            {progress.progress.toFixed(1)}% 完了
          </div>

          <button
            onClick={onBack}
            style={{
              marginTop: 32,
              padding: '8px 16px',
              background: 'none',
              border: '1px solid #555',
              color: '#9aa',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            キャンセル
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#1a1a1a',
      zIndex: 1000,
      padding: 20,
      overflow: 'auto'
    }}>
      {/* ヘッダー */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: 32
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: '#0ea5e9',
            fontSize: 16,
            cursor: 'pointer'
          }}
        >
          ← 戻る
        </button>
        <div style={{
          fontSize: 20,
          fontWeight: 600,
          marginLeft: 16
        }}>
          動画アップロード
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div style={{
          padding: 16,
          background: '#2d1b1b',
          border: '1px solid #dc2626',
          borderRadius: 8,
          color: '#fca5a5',
          marginBottom: 24
        }}>
          {error}
        </div>
      )}

      {/* ファイル選択エリア */}
      {!selectedFile ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '2px dashed #555',
            borderRadius: 12,
            padding: 64,
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'border-color 0.2s ease',
            marginBottom: 24
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
            const file = e.dataTransfer.files[0]
            if (file) handleFileSelect(file)
          }}
        >
          <div style={{ fontSize: 64, marginBottom: 16 }}>📁</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            動画ファイルをドラッグ＆ドロップ
          </div>
          <div style={{ color: '#9aa', marginBottom: 16 }}>
            または、クリックしてファイルを選択
          </div>
          <div style={{ fontSize: 12, color: '#777', lineHeight: 1.4 }}>
            対応形式: MP4, MOV, AVI<br />
            最大サイズ: 1000MB、最大時間: 20分
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="video/*"
            capture="environment"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
          />
        </div>
        <button
          onClick={() => cameraInputRef.current?.click()}
          style={{
            display: 'block',
            width: '100%',
            padding: '12px 24px',
            background: 'none',
            color: '#0ea5e9',
            border: '1px solid #0ea5e9',
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: 16
          }}
        >
          カメラで撮影
        </button>
      ) : (
        /* ファイル確認・処理開始エリア */
        <div style={{
          border: '1px solid #555',
          borderRadius: 12,
          padding: 24,
          marginBottom: 24
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 16
          }}>
            <div style={{ fontSize: 32, marginRight: 16 }}>🎬</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                {selectedFile.name}
              </div>
              <div style={{ color: '#9aa', fontSize: 14 }}>
                {formatFileSize(selectedFile.size)} • {videoMetadata && formatDuration(videoMetadata.duration)}
                {videoMetadata && ` • ${videoMetadata.width}×${videoMetadata.height}`}
              </div>
            </div>
          </div>

          <div style={{ 
            background: '#2a2a2a',
            padding: 16,
            borderRadius: 8,
            marginBottom: 16
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              処理設定
            </div>
            <div style={{ color: '#9aa', fontSize: 12, lineHeight: 1.4 }}>
              解像度: 480×270 (軽量化)<br />
              フレームレート: 2fps (元動画の1/15)<br />
              推定処理時間: 2-5分<br />
              推定サイズ削減: 約95%
            </div>
          </div>

          <div style={{
            display: 'flex',
            gap: 12
          }}>
            <button
              onClick={startPreprocessing}
              style={{
                flex: 1,
                padding: '12px 24px',
                background: '#0ea5e9',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              処理開始
            </button>
            <button
              onClick={() => setSelectedFile(null)}
              style={{
                padding: '12px 24px',
                background: 'none',
                color: '#9aa',
                border: '1px solid #555',
                borderRadius: 8,
                cursor: 'pointer'
              }}
            >
              変更
            </button>
          </div>
        </div>
      )}

      {/* 注意事項 */}
      <div style={{
        background: '#2a2a2a',
        padding: 16,
        borderRadius: 8,
        fontSize: 12,
        color: '#9aa',
        lineHeight: 1.4
      }}>
        <div style={{ fontWeight: 600, marginBottom: 8, color: '#ddd' }}>
          📋 処理について
        </div>
        • 動画は軽量化のため大幅に圧縮されます<br />
        • バスケットボールとゴールが明確に映っている動画を推奨します<br />
        • 固定カメラでの撮影が最も精度が高くなります<br />
        • 処理中はブラウザを閉じないでください
      </div>
    </div>
  )
}