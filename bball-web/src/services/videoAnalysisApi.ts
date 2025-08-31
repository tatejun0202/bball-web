// src/services/videoAnalysisApi.ts
// Railway解析サーバーとの通信

export interface AnalysisRequest {
  frames: Array<{
    timestamp: number
    data: string // Base64画像データ
    width: number
    height: number
  }>
  metadata: {
    targetFps: number
    originalDuration: number
    targetWidth: number
    targetHeight: number
    compressionRatio: number
  }
}

export interface ShotDetection {
  timestamp: number
  position: {
    x: number // 正規化座標 (0.0-1.0)
    y: number // 正規化座標 (0.0-1.0)
  }
  result: 'make' | 'miss'
  confidence: number
  frame_index?: number
}

export interface AnalysisResult {
  shots: ShotDetection[]
  summary: {
    total_attempts: number
    makes: number
    misses: number
    fg_percentage: number
  }
  metadata: {
    frames_processed: number
    processing_time: string
    [key: string]: any
  }
}

export interface AnalysisProgress {
  stage: 'uploading' | 'processing' | 'complete' | 'error'
  progress: number // 0-100
  message?: string
}

export class VideoAnalysisApi {
  private baseUrl: string
  private retryCount = 3
  private timeout = 300000 // 5分タイムアウト

  constructor() {
    // Railway デプロイ後は実際のURLに変更
    this.baseUrl = process.env.NEXT_PUBLIC_ANALYSIS_SERVER_URL || 'http://localhost:8000'
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      return response.ok
    } catch (error) {
      console.error('Health check failed:', error)
      return false
    }
  }

  async analyzeFrames(
    request: AnalysisRequest,
    onProgress?: (progress: AnalysisProgress) => void
  ): Promise<AnalysisResult> {
    
    let attempt = 0
    
    while (attempt < this.retryCount) {
      try {
        onProgress?.({
          stage: 'uploading',
          progress: 10,
          message: 'サーバーにデータを送信中...'
        })

        // ヘルスチェック
        const isHealthy = await this.healthCheck()
        if (!isHealthy) {
          throw new Error('Analysis server is not available')
        }

        onProgress?.({
          stage: 'processing',
          progress: 30,
          message: 'フレームを解析中...'
        })

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.timeout)

        const response = await fetch(`${this.baseUrl}/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(request),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.message || `Server error: ${response.status}`)
        }

        onProgress?.({
          stage: 'processing',
          progress: 90,
          message: '解析結果を処理中...'
        })

        const result: AnalysisResult = await response.json()

        onProgress?.({
          stage: 'complete',
          progress: 100,
          message: '解析完了'
        })

        return result

      } catch (error) {
        attempt++
        console.error(`Analysis attempt ${attempt} failed:`, error)

        if (attempt >= this.retryCount) {
          onProgress?.({
            stage: 'error',
            progress: 0,
            message: error instanceof Error ? error.message : '解析に失敗しました'
          })
          throw error
        }

        // リトライ前に少し待機
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    }

    throw new Error('Analysis failed after multiple attempts')
  }

  async testConnection(): Promise<{
    connected: boolean
    serverInfo?: any
    error?: string
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/test`)
      
      if (response.ok) {
        const serverInfo = await response.json()
        return {
          connected: true,
          serverInfo
        }
      } else {
        return {
          connected: false,
          error: `HTTP ${response.status}`
        }
      }
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      }
    }
  }

  // デバッグ用: フレーム数を制限してテスト
  async analyzeFramesTest(request: AnalysisRequest): Promise<AnalysisResult> {
    // 最初の10フレームのみで テスト
    const testRequest = {
      ...request,
      frames: request.frames.slice(0, 10)
    }

    return this.analyzeFrames(testRequest)
  }
}

// シングルトンインスタンス
export const videoAnalysisApi = new VideoAnalysisApi()

// 座標変換ユーティリティ
export const convertToCourtCoordinates = (
  normalizedX: number,
  normalizedY: number,
  courtWidth: number = 340,
  courtHeight: number = 238 // 340 * (768/1095) のアスペクト比
): { x: number, y: number } => {
  return {
    x: normalizedX * courtWidth,
    y: normalizedY * courtHeight
  }
}

export const convertToNormalizedCoordinates = (
  x: number,
  y: number,
  courtWidth: number = 340,
  courtHeight: number = 238
): { x: number, y: number } => {
  return {
    x: x / courtWidth,
    y: y / courtHeight
  }
}