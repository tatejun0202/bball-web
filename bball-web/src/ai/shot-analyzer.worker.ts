import { ShotAnalyzer } from './shot-analyzer'
import type { AnalysisConfig } from './types'

interface WorkerMessage {
  id: string
  type: 'initialize' | 'analyze-video' | 'analyze-frame' | 'dispose'
  data?: unknown
}

interface WorkerResponse {
  id: string
  type: 'success' | 'error' | 'progress'
  data?: unknown
}

class ShotAnalyzerWorker {
  private analyzer: ShotAnalyzer | null = null
  private isInitialized = false

  constructor() {
    self.onmessage = this.handleMessage.bind(this)
  }

  private async handleMessage(event: MessageEvent<WorkerMessage>) {
    const { id, type, data } = event.data

    try {
      switch (type) {
        case 'initialize':
          await this.initialize((data as { config?: Partial<AnalysisConfig> })?.config)
          this.postMessage({ id, type: 'success', data: { initialized: true } })
          break

        case 'analyze-video':
          await this.analyzeVideo(id, (data as { videoUrl: string })?.videoUrl, (data as { config?: Partial<AnalysisConfig> })?.config)
          break

        case 'analyze-frame':
          const frame = await this.analyzeFrame((data as { imageData: ImageData })?.imageData, (data as { timestamp: number })?.timestamp)
          this.postMessage({ id, type: 'success', data: frame })
          break

        case 'dispose':
          this.dispose()
          this.postMessage({ id, type: 'success' })
          break

        default:
          throw new Error(`Unknown message type: ${type}`)
      }
    } catch (error) {
      this.postMessage({
        id,
        type: 'error',
        data: { message: error instanceof Error ? error.message : 'Unknown error' }
      })
    }
  }

  private async initialize(config?: Partial<AnalysisConfig>) {
    if (this.isInitialized) return

    this.analyzer = new ShotAnalyzer(config)
    await this.analyzer.initialize()
    this.isInitialized = true
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async analyzeVideo(messageId: string, _videoUrl: string, _config?: Partial<AnalysisConfig>) {
    if (!this.analyzer) throw new Error('Analyzer not initialized')

    // WebWorker内でのビデオ解析は複雑なため、代替アプローチを使用
    // 実際の実装では、メインスレッドからフレームデータを受信して解析
    this.postMessage({
      id: messageId,
      type: 'error',
      data: { message: 'Video analysis in WebWorker requires frame-by-frame approach' }
    })
  }

  private async analyzeFrame(imageData: ImageData, timestamp: number) {
    if (!this.analyzer) throw new Error('Analyzer not initialized')

    // ImageDataからCanvasを作成してTensorFlow.jsで解析
    const canvas = new OffscreenCanvas(imageData.width, imageData.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Cannot create canvas context')

    ctx.putImageData(imageData, 0, 0)
    
    return await this.analyzer.analyzeCanvasFrame(canvas as unknown as HTMLCanvasElement, timestamp)
  }

  private dispose() {
    if (this.analyzer) {
      this.analyzer.dispose()
      this.analyzer = null
    }
    this.isInitialized = false
  }

  private postMessage(response: WorkerResponse) {
    self.postMessage(response)
  }
}

// WebWorkerの初期化
new ShotAnalyzerWorker()

// TypeScript用のエクスポート（実際には使用されない）
export default ShotAnalyzerWorker