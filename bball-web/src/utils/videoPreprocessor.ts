// src/utils/videoPreprocessor.ts
// 動画前処理のメインクラス

export interface VideoPreprocessingOptions {
  targetWidth?: number
  targetHeight?: number
  targetFps?: number
  quality?: number
  maxDuration?: number // 秒
}

export interface PreprocessingResult {
  frames: Array<{
    timestamp: number
    data: string // Base64エンコードされた画像データ
    width: number
    height: number
  }>
  originalSize: number
  processedSize: number
  frameCount: number
  duration: number
  metadata: VideoPreprocessingOptions & {
    compressionRatio: number
  }
}

export interface PreprocessingProgress {
  stage: 'initializing' | 'extracting' | 'encoding' | 'complete'
  progress: number // 0-100
  message?: string
}

export class VideoPreprocessor {
  private worker: Worker | null = null

  constructor() {
    // Web Worker初期化はprocess開始時に行う
  }

  async processVideo(
    videoFile: File,
    options: VideoPreprocessingOptions = {},
    onProgress?: (progress: PreprocessingProgress) => void
  ): Promise<PreprocessingResult> {
    
    return new Promise((resolve, reject) => {
      try {
        // Web Worker初期化
        this.worker = new Worker('/workers/video-preprocessor.js')
        
        // メッセージハンドラー設定
        this.worker.onmessage = (e) => {
          const { type, data } = e.data
          
          switch (type) {
            case 'PROGRESS':
              onProgress?.(data)
              break
              
            case 'COMPLETE':
              this.cleanup()
              
              // 圧縮率計算
              const compressionRatio = data.originalSize > 0 
                ? (data.originalSize - data.processedSize) / data.originalSize 
                : 0
              
              resolve({
                ...data,
                duration: this.estimateDuration(data.frameCount, options.targetFps || 2),
                metadata: {
                  ...data.metadata,
                  compressionRatio
                }
              })
              break
              
            case 'ERROR':
              this.cleanup()
              reject(new Error(data.message))
              break
          }
        }

        this.worker.onerror = (error) => {
          this.cleanup()
          reject(error)
        }

        // 動画処理開始
        this.worker.postMessage({
          type: 'PROCESS_VIDEO',
          data: {
            videoBlob: videoFile,
            options: {
              targetWidth: 480,
              targetHeight: 270,
              targetFps: 2,
              quality: 0.7,
              ...options
            }
          }
        })

      } catch (error) {
        this.cleanup()
        reject(error)
      }
    })
  }

  // より軽量なフレーム抽出（メインスレッド実装）
  async processVideoLightweight(
    videoFile: File,
    options: VideoPreprocessingOptions = {},
    onProgress?: (progress: PreprocessingProgress) => void
  ): Promise<PreprocessingResult> {
    
    const {
      targetWidth = 480,
      targetHeight = 270,
      targetFps = 2,
      quality = 0.7,
      maxDuration = 1200 // 20分
    } = options

    onProgress?.({ stage: 'initializing', progress: 0 })

    // 動画要素作成
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    canvas.width = targetWidth
    canvas.height = targetHeight

    return new Promise((resolve, reject) => {
      video.onloadedmetadata = async () => {
        try {
          const duration = Math.min(video.duration, maxDuration)
          const frameInterval = 1 / targetFps
          const totalFrames = Math.floor(duration * targetFps)
          const frames: Array<{ timestamp: number; data: string; width: number; height: number }> = []

          onProgress?.({ stage: 'extracting', progress: 10 })

          // フレーム抽出
          for (let i = 0; i < totalFrames; i++) {
            const timestamp = i * frameInterval
            
            // 動画の該当時刻にシーク
            await new Promise<void>((seekResolve) => {
              video.onseeked = () => seekResolve()
              video.currentTime = timestamp
            })

            // Canvasに描画
            ctx.drawImage(video, 0, 0, targetWidth, targetHeight)
            
            // Base64エンコード
            const frameData = canvas.toDataURL('image/jpeg', quality)
            
            frames.push({
              timestamp: timestamp * 1000, // ミリ秒に変換
              data: frameData,
              width: targetWidth,
              height: targetHeight
            })

            // 進捗更新
            const progress = 10 + ((i + 1) / totalFrames) * 80
            onProgress?.({ stage: 'extracting', progress })
          }

          onProgress?.({ stage: 'encoding', progress: 90 })

          // サイズ計算
          const processedSize = frames.reduce((total, frame) => {
            return total + (frame.data.length * 0.75) // Base64サイズ概算
          }, 0)

          const compressionRatio = (videoFile.size - processedSize) / videoFile.size

          onProgress?.({ stage: 'complete', progress: 100 })

          resolve({
            frames,
            originalSize: videoFile.size,
            processedSize,
            frameCount: frames.length,
            duration,
            metadata: {
              targetWidth,
              targetHeight,
              targetFps,
              quality,
              compressionRatio
            }
          })

        } catch (error) {
          reject(error)
        }
      }

      video.onerror = () => {
        reject(new Error('動画の読み込みに失敗しました'))
      }

      // 動画ファイル読み込み
      video.src = URL.createObjectURL(videoFile)
      video.load()
    })
  }

  private estimateDuration(frameCount: number, fps: number): number {
    return frameCount / fps
  }

  private cleanup() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
  }

  // バリデーション機能
  static validateVideoFile(file: File): { valid: boolean; error?: string } {
    // ファイルタイプチェック
    const allowedTypes = ['video/mp4', 'video/mov', 'video/quicktime', 'video/avi']
    if (!allowedTypes.includes(file.type)) {
      return { 
        valid: false, 
        error: `対応していないファイル形式です。対応形式: ${allowedTypes.join(', ')}` 
      }
    }

    // ファイルサイズチェック（1000MB = 1GB）
    const maxSize = 1000 * 1024 * 1024
    if (file.size > maxSize) {
      return { 
        valid: false, 
        error: `ファイルサイズが大きすぎます。最大サイズ: ${maxSize / (1024 * 1024)}MB` 
      }
    }

    return { valid: true }
  }

  // 動画メタデータ取得
  static async getVideoMetadata(file: File): Promise<{
    duration: number
    width: number
    height: number
    size: number
    type: string
  }> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      
      video.onloadedmetadata = () => {
        resolve({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          size: file.size,
          type: file.type
        })
        URL.revokeObjectURL(video.src)
      }

      video.onerror = () => {
        reject(new Error('動画メタデータの取得に失敗しました'))
        URL.revokeObjectURL(video.src)
      }

      video.src = URL.createObjectURL(file)
      video.load()
    })
  }
}