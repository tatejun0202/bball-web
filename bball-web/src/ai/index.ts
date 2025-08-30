// AI解析エンジンのメインエクスポート
export { ShotDetector } from './shot-detector'
export { TrajectoryAnalyzer } from './trajectory-analyzer'
export { ShotAnalyzer } from './shot-analyzer'
export { WorkerManager } from './worker-manager'

// 型定義のエクスポート
export type {
  DetectedObject,
  BallPosition,
  TrajectoryPoint,
  ShotEvent,
  AnalysisFrame,
  AnalysisResult,
  AnalysisConfig,
  ModelLoadStatus
} from './types'

// 使いやすいファクトリー関数
export const createShotAnalyzer = async (config?: Partial<import('./types').AnalysisConfig>) => {
  const { ShotAnalyzer } = await import('./shot-analyzer')
  const analyzer = new ShotAnalyzer(config)
  await analyzer.initialize()
  return analyzer
}

// WebWorker版の作成関数
export const createWorkerAnalyzer = async (config?: Partial<import('./types').AnalysisConfig>) => {
  const { WorkerManager } = await import('./worker-manager')
  const worker = new WorkerManager()
  try {
    await worker.initialize(config)
    return worker
  } catch (error) {
    // WebWorkerが使用できない場合は通常版にフォールバック
    console.warn('WebWorker fallback to main thread:', error)
    worker.dispose()
    return createShotAnalyzer(config)
  }
}

// デフォルト設定
export const DEFAULT_ANALYSIS_CONFIG: import('./types').AnalysisConfig = {
  frameRate: 30,
  analysisFrameRate: 10,
  ballConfidenceThreshold: 0.3,
  trajectoryHistorySeconds: 3,
  shotMinimumDuration: 0.5,
  shotMaximumDuration: 5,
  goalAreaThreshold: 0.7,
  parabolicThreshold: 0.8
}

// ユーティリティ関数
export const formatAnalysisResult = (result: import('./types').AnalysisResult) => {
  const { shots, processingTime, averageConfidence } = result
  const madeShots = shots.filter(s => s.outcome === 'made').length
  const missedShots = shots.filter(s => s.outcome === 'missed').length
  const accuracy = shots.length > 0 ? (madeShots / shots.length) * 100 : 0

  return {
    summary: {
      totalShots: shots.length,
      made: madeShots,
      missed: missedShots,
      accuracy: Math.round(accuracy * 100) / 100,
      confidence: Math.round(averageConfidence * 100),
      processingTime: Math.round(processingTime)
    },
    shots: shots.map(shot => ({
      id: shot.id,
      time: shot.startTime,
      duration: shot.endTime - shot.startTime,
      result: shot.outcome,
      confidence: Math.round(shot.confidence * 100),
      position: {
        x: Math.round(shot.peak?.x || shot.trajectory[0]?.position.x || 0),
        y: Math.round(shot.peak?.y || shot.trajectory[0]?.position.y || 0)
      }
    }))
  }
}

// V2システムとの互換性レイヤー
export const convertToV2Format = (shots: import('./types').ShotEvent[]) => {
  return shots
    .filter(shot => shot.outcome !== 'unknown')
    .map(shot => ({
      timestamp: shot.startTime,
      result: shot.outcome === 'made' ? 'success' : 'miss',
      confidence: shot.confidence,
      position: {
        x: shot.peak?.x || shot.trajectory[0]?.position.x || 0,
        y: shot.peak?.y || shot.trajectory[0]?.position.y || 0
      },
      trajectory: shot.trajectory.map(point => ({
        x: point.position.x,
        y: point.position.y,
        t: point.position.timestamp
      }))
    }))
}