import type { AnalysisConfig } from './types'

export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer | null = null
  
  private performanceMetrics = {
    totalAnalysisTime: 0,
    framesProcessed: 0,
    averageFrameTime: 0,
    memoryUsage: 0,
    cpuUsage: 0
  }

  private deviceCapabilities = {
    cores: navigator.hardwareConcurrency || 4,
    memory: (performance as unknown as { memory?: { jsHeapSizeLimit: number } }).memory?.jsHeapSizeLimit || 2147483648, // 2GB default
    isMobile: /Mobi|Android/i.test(navigator.userAgent),
    isLowEnd: false
  }

  static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer()
    }
    return PerformanceOptimizer.instance
  }

  private constructor() {
    this.detectDeviceCapabilities()
    this.setupPerformanceMonitoring()
  }

  private detectDeviceCapabilities() {
    // メモリベースの低スペック判定
    const availableMemory = this.deviceCapabilities.memory / (1024 * 1024 * 1024) // GB
    const coreCount = this.deviceCapabilities.cores
    
    this.deviceCapabilities.isLowEnd = 
      availableMemory < 3 || 
      coreCount < 4 || 
      this.deviceCapabilities.isMobile

    console.log('Device capabilities:', this.deviceCapabilities)
  }

  private setupPerformanceMonitoring() {
    // Performance Observer for monitoring
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach(entry => {
            if (entry.name.includes('tensorflow') || entry.name.includes('ai-analysis')) {
              this.updatePerformanceMetrics(entry.duration)
            }
          })
        })
        observer.observe({ entryTypes: ['measure', 'mark'] })
      } catch (e) {
        console.warn('PerformanceObserver not supported:', e)
      }
    }
  }

  private updatePerformanceMetrics(duration: number) {
    this.performanceMetrics.totalAnalysisTime += duration
    this.performanceMetrics.framesProcessed++
    this.performanceMetrics.averageFrameTime = 
      this.performanceMetrics.totalAnalysisTime / this.performanceMetrics.framesProcessed

    // メモリ使用量の監視
    const perfMemory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
    if (perfMemory) {
      this.performanceMetrics.memoryUsage = perfMemory.usedJSHeapSize
    }
  }

  // デバイスに最適化された設定を提案
  getOptimizedConfig(baseConfig: AnalysisConfig): AnalysisConfig {
    const optimized = { ...baseConfig }

    if (this.deviceCapabilities.isLowEnd) {
      // 低スペックデバイス向け最適化
      optimized.analysisFrameRate = Math.max(3, baseConfig.analysisFrameRate * 0.6)
      optimized.ballConfidenceThreshold = Math.min(0.5, baseConfig.ballConfidenceThreshold + 0.1)
      optimized.trajectoryHistorySeconds = Math.max(1.5, baseConfig.trajectoryHistorySeconds * 0.7)
    } else if (this.deviceCapabilities.cores >= 8 && !this.deviceCapabilities.isMobile) {
      // 高スペックデバイス向け最適化
      optimized.analysisFrameRate = Math.min(15, baseConfig.analysisFrameRate * 1.5)
      optimized.ballConfidenceThreshold = Math.max(0.25, baseConfig.ballConfidenceThreshold - 0.05)
    }

    // 現在のパフォーマンスに基づく動的調整
    if (this.performanceMetrics.averageFrameTime > 200) { // 200ms以上かかっている場合
      optimized.analysisFrameRate *= 0.8
      optimized.ballConfidenceThreshold += 0.05
    } else if (this.performanceMetrics.averageFrameTime < 50) { // 50ms未満の場合
      optimized.analysisFrameRate *= 1.2
      optimized.ballConfidenceThreshold = Math.max(0.2, optimized.ballConfidenceThreshold - 0.05)
    }

    console.log('Optimized config for device:', optimized)
    return optimized
  }

  // バッチサイズの最適化
  getOptimalBatchSize(): number {
    if (this.deviceCapabilities.isLowEnd) {
      return 5
    } else if (this.deviceCapabilities.cores >= 8) {
      return 30
    }
    return 15
  }

  // 並行処理数の最適化
  getOptimalConcurrency(): number {
    const baseConcurrency = Math.max(2, Math.floor(this.deviceCapabilities.cores / 2))
    
    if (this.deviceCapabilities.isLowEnd) {
      return Math.max(1, baseConcurrency - 1)
    }
    
    return baseConcurrency
  }

  // メモリ使用量チェック
  isMemoryPressure(): boolean {
    const perfMemory = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory
    if (!perfMemory) return false
    
    const used = perfMemory.usedJSHeapSize
    const limit = perfMemory.jsHeapSizeLimit
    
    return used / limit > 0.85 // 85%以上使用している場合
  }

  // ガベージコレクションの提案
  suggestGarbageCollection(): boolean {
    return this.isMemoryPressure() && this.performanceMetrics.framesProcessed % 100 === 0
  }

  // パフォーマンス統計の取得
  getPerformanceStats() {
    return {
      ...this.performanceMetrics,
      deviceInfo: this.deviceCapabilities,
      recommendations: this.getPerformanceRecommendations()
    }
  }

  private getPerformanceRecommendations(): string[] {
    const recommendations = []

    if (this.deviceCapabilities.isLowEnd) {
      recommendations.push('低スペックデバイス: 解析精度を下げて処理速度を優先')
    }

    if (this.performanceMetrics.averageFrameTime > 150) {
      recommendations.push('処理速度が遅い: フレームレートを下げることを推奨')
    }

    if (this.isMemoryPressure()) {
      recommendations.push('メモリ不足: 軌道履歴時間を短縮することを推奨')
    }

    if (this.deviceCapabilities.isMobile) {
      recommendations.push('モバイルデバイス: バッテリー消費を抑えるため処理を最適化')
    }

    return recommendations
  }

  // 動的品質調整
  dynamicQualityAdjustment(currentFPS: number, targetFPS: number): Partial<AnalysisConfig> {
    const adjustment: Partial<AnalysisConfig> = {}
    
    const fpsRatio = currentFPS / targetFPS

    if (fpsRatio < 0.7) {
      // パフォーマンスが目標を大きく下回る場合
      adjustment.analysisFrameRate = Math.max(3, Math.floor(targetFPS * 0.6))
      adjustment.ballConfidenceThreshold = 0.4
    } else if (fpsRatio < 0.9) {
      // パフォーマンスが目標をやや下回る場合
      adjustment.analysisFrameRate = Math.max(5, Math.floor(targetFPS * 0.8))
      adjustment.ballConfidenceThreshold = 0.35
    } else if (fpsRatio > 1.3) {
      // パフォーマンスに余裕がある場合
      adjustment.analysisFrameRate = Math.min(15, Math.floor(targetFPS * 1.2))
      adjustment.ballConfidenceThreshold = 0.25
    }

    return adjustment
  }

  // リソース使用量の最適化
  optimizeResourceUsage() {
    if (this.suggestGarbageCollection()) {
      // 手動でガベージコレクションを促す
      const windowWithGc = window as unknown as { gc?: () => void }
      if (windowWithGc.gc) {
        windowWithGc.gc()
      } else {
        // ガベージコレクションを促すためのダミー処理
        const dummy = new Array(100000).fill(null)
        dummy.length = 0
      }
    }
  }

  // WebWorker利用可否の判定
  shouldUseWebWorker(): boolean {
    return !this.deviceCapabilities.isLowEnd && 
           this.deviceCapabilities.cores >= 4 &&
           typeof Worker !== 'undefined'
  }

  reset() {
    this.performanceMetrics = {
      totalAnalysisTime: 0,
      framesProcessed: 0,
      averageFrameTime: 0,
      memoryUsage: 0,
      cpuUsage: 0
    }
  }
}