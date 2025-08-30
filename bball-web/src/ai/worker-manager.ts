import type { AnalysisConfig, AnalysisFrame, AnalysisResult } from './types'

interface PendingRequest {
  resolve: (data: any) => void
  reject: (error: Error) => void
}

export class WorkerManager {
  private worker: Worker | null = null
  private pendingRequests = new Map<string, PendingRequest>()
  private requestCounter = 0
  private isInitialized = false

  constructor() {
    this.initializeWorker()
  }

  private initializeWorker() {
    try {
      // WebWorkerのパスを動的に生成
      const workerBlob = new Blob([`
        importScripts('${window.location.origin}/_next/static/chunks/ai-worker.js');
      `], { type: 'application/javascript' })

      this.worker = new Worker(URL.createObjectURL(workerBlob))
      this.worker.onmessage = this.handleWorkerMessage.bind(this)
      this.worker.onerror = this.handleWorkerError.bind(this)
    } catch (error) {
      console.warn('WebWorker initialization failed, falling back to main thread:', error)
      this.worker = null
    }
  }

  private handleWorkerMessage(event: MessageEvent) {
    const { id, type, data } = event.data
    const request = this.pendingRequests.get(id)

    if (!request) return

    this.pendingRequests.delete(id)

    if (type === 'success') {
      request.resolve(data)
    } else if (type === 'error') {
      request.reject(new Error(data?.message || 'Worker error'))
    } else if (type === 'progress') {
      // プログレスイベントは特別処理（resolveしない）
      // 実際の実装では、プログレスコールバックを呼び出す
    }
  }

  private handleWorkerError(error: ErrorEvent) {
    console.error('WebWorker error:', error)
    
    // 全ての保留中のリクエストをエラーで完了
    this.pendingRequests.forEach((request) => {
      request.reject(new Error('WebWorker crashed'))
    })
    this.pendingRequests.clear()

    // Workerを再初期化
    this.worker?.terminate()
    this.initializeWorker()
    this.isInitialized = false
  }

  private sendMessage(type: string, data?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('WebWorker not available'))
        return
      }

      const id = `req_${++this.requestCounter}`
      this.pendingRequests.set(id, { resolve, reject })

      this.worker.postMessage({ id, type, data })

      // タイムアウト設定（30秒）
      setTimeout(() => {
        const request = this.pendingRequests.get(id)
        if (request) {
          this.pendingRequests.delete(id)
          request.reject(new Error('Request timeout'))
        }
      }, 30000)
    })
  }

  async initialize(config?: Partial<AnalysisConfig>): Promise<void> {
    if (this.isInitialized) return

    if (!this.worker) {
      throw new Error('WebWorker not available')
    }

    await this.sendMessage('initialize', { config })
    this.isInitialized = true
  }

  async analyzeFrame(imageData: ImageData, timestamp: number): Promise<AnalysisFrame> {
    if (!this.isInitialized) {
      throw new Error('Worker not initialized')
    }

    return await this.sendMessage('analyze-frame', { imageData, timestamp })
  }

  // フレームバイフレーム解析用のヘルパー
  async analyzeVideoFrameByFrame(
    video: HTMLVideoElement,
    onProgress?: (progress: number) => void
  ): Promise<AnalysisResult> {
    if (!this.isInitialized) {
      throw new Error('Worker not initialized')
    }

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Cannot create canvas context')
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const duration = video.duration
    const frameRate = 30 // 仮定
    const analysisFrameRate = 5 // 5fps で解析
    const frameInterval = 1 / analysisFrameRate
    const totalFrames = Math.floor(duration * analysisFrameRate)

    const frames: AnalysisFrame[] = []
    let processedFrames = 0

    for (let time = 0; time < duration; time += frameInterval) {
      try {
        // フレーム抽出
        await this.seekVideoToTime(video, time)
        
        // Canvas に描画
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

        // WebWorker で解析
        const frame = await this.analyzeFrame(imageData, time)
        frames.push(frame)

        processedFrames++
        
        if (onProgress && processedFrames % 5 === 0) {
          onProgress(processedFrames / totalFrames)
        }

      } catch (error) {
        console.warn(`Frame analysis failed at ${time}s:`, error)
      }
    }

    if (onProgress) onProgress(1)

    // 結果をまとめる（簡略版）
    return {
      shots: [], // 実際の軌道解析は別途実装が必要
      totalFrames,
      processedFrames,
      processingTime: 0,
      averageConfidence: frames.reduce((sum, f) => sum + (f.ballPosition?.confidence || 0), 0) / frames.length,
      metadata: {
        modelVersion: 'TensorFlow.js WebWorker',
        analysisDate: new Date().toISOString()
      }
    }
  }

  private seekVideoToTime(video: HTMLVideoElement, time: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked)
        resolve()
      }

      const onError = () => {
        video.removeEventListener('error', onError)
        reject(new Error('Video seek failed'))
      }

      video.addEventListener('seeked', onSeeked, { once: true })
      video.addEventListener('error', onError, { once: true })
      video.currentTime = time
    })
  }

  isWorkerAvailable(): boolean {
    return this.worker !== null
  }

  dispose(): void {
    if (this.worker) {
      this.sendMessage('dispose').catch(() => {})
      this.worker.terminate()
      this.worker = null
    }

    this.pendingRequests.clear()
    this.isInitialized = false
  }
}