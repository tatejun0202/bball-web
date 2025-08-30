import { ShotDetector } from './shot-detector';
import { TrajectoryAnalyzer } from './trajectory-analyzer';
import { PerformanceOptimizer } from './performance-optimizer';
import type { 
  AnalysisResult, 
  AnalysisFrame, 
  AnalysisConfig,
  ShotEvent,
  BallPosition,
  TrajectoryPoint
} from './types';

export class ShotAnalyzer {
  private detector: ShotDetector;
  private trajectoryAnalyzer: TrajectoryAnalyzer;
  private performanceOptimizer: PerformanceOptimizer;
  private analysisFrames: AnalysisFrame[] = [];
  private isAnalyzing = false;
  
  private config: AnalysisConfig = {
    frameRate: 30,
    analysisFrameRate: 8, // パフォーマンス最適化: 10→8fps
    ballConfidenceThreshold: 0.35, // 精度向上: 0.3→0.35
    trajectoryHistorySeconds: 2.5, // メモリ最適化: 3→2.5秒
    shotMinimumDuration: 0.4, // 精度向上: 0.5→0.4秒
    shotMaximumDuration: 4.5, // 最適化: 5→4.5秒
    goalAreaThreshold: 0.7,
    parabolicThreshold: 0.75 // 精度向上: 0.8→0.75
  };

  constructor(config?: Partial<AnalysisConfig>) {
    this.performanceOptimizer = PerformanceOptimizer.getInstance();
    
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    // パフォーマンス最適化された設定を適用
    this.config = this.performanceOptimizer.getOptimizedConfig(this.config);
    
    this.detector = new ShotDetector(this.config);
    this.trajectoryAnalyzer = new TrajectoryAnalyzer(this.config);
  }

  async initialize(): Promise<void> {
    await this.detector.loadModel();
  }

  getModelStatus() {
    return this.detector.getModelStatus();
  }

  async analyzeVideo(video: HTMLVideoElement, onProgress?: (progress: number) => void): Promise<AnalysisResult> {
    if (this.isAnalyzing) {
      throw new Error('Analysis already in progress');
    }

    this.isAnalyzing = true;
    const startTime = performance.now();
    
    try {
      this.reset();
      
      const duration = video.duration;
      const frameInterval = 1 / this.config.analysisFrameRate;
      const totalFrames = Math.floor(duration * this.config.analysisFrameRate);
      let processedFrames = 0;

      // フレーム分析
      for (let time = 0; time < duration; time += frameInterval) {
        try {
          const frame = await this.detector.analyzeVideoFrame(video, time);
          this.analysisFrames.push(frame);
          
          if (frame.ballPosition) {
            this.trajectoryAnalyzer.addBallPosition(frame.ballPosition);
          }
          
          processedFrames++;
          
          if (onProgress && processedFrames % 10 === 0) {
            onProgress(processedFrames / totalFrames);
          }
        } catch (error) {
          console.warn(`Frame analysis failed at ${time}s:`, error);
        }
      }

      // 最終処理
      if (onProgress) onProgress(1);
      
      const processingTime = performance.now() - startTime;
      const shots = this.trajectoryAnalyzer.getAllShots();
      
      return this.createAnalysisResult(shots, totalFrames, processedFrames, processingTime);
      
    } finally {
      this.isAnalyzing = false;
    }
  }

  async analyzeRealtimeFrame(
    video: HTMLVideoElement,
    timestamp?: number
  ): Promise<AnalysisFrame> {
    const frame = await this.detector.detectFromVideo(video, timestamp);
    
    if (frame.ballPosition) {
      this.trajectoryAnalyzer.addBallPosition(frame.ballPosition);
    }
    
    return frame;
  }

  async analyzeCanvasFrame(
    canvas: HTMLCanvasElement,
    timestamp: number,
    frameIndex?: number
  ): Promise<AnalysisFrame> {
    const frame = await this.detector.detectFromCanvas(canvas, timestamp, frameIndex);
    
    if (frame.ballPosition) {
      this.trajectoryAnalyzer.addBallPosition(frame.ballPosition);
    }
    
    return frame;
  }

  private createAnalysisResult(
    shots: ShotEvent[],
    totalFrames: number,
    processedFrames: number,
    processingTime: number
  ): AnalysisResult {
    const validShots = shots.filter(shot => shot.confidence > 0.5);
    const averageConfidence = validShots.length > 0
      ? validShots.reduce((sum, shot) => sum + shot.confidence, 0) / validShots.length
      : 0;

    return {
      shots: validShots,
      totalFrames,
      processedFrames,
      processingTime,
      averageConfidence,
      metadata: {
        modelVersion: this.detector.getModelStatus().modelName,
        analysisDate: new Date().toISOString()
      }
    };
  }

  getCurrentShots(): ShotEvent[] {
    return this.trajectoryAnalyzer.getCurrentShots();
  }

  getCompletedShots(): ShotEvent[] {
    return this.trajectoryAnalyzer.getCompletedShots();
  }

  getAllShots(): ShotEvent[] {
    return this.trajectoryAnalyzer.getAllShots();
  }

  getTrajectoryHistory(): BallPosition[] {
    return this.trajectoryAnalyzer.getTrajectoryHistory();
  }

  getRecentAnalysisFrames(count = 10): AnalysisFrame[] {
    return this.analysisFrames.slice(-count);
  }

  // V2データ形式へのコンバーター
  convertToV2Format(shots: ShotEvent[]): Array<{
    timestamp: number;
    result: 'success' | 'miss';
    confidence: number;
    position: { x: number; y: number };
    trajectory?: Array<{ x: number; y: number; t: number }>;
  }> {
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
      }));
  }

  // 精度向上のための段階的処理
  async analyzeVideoProgressive(
    video: HTMLVideoElement,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<AnalysisResult> {
    if (this.isAnalyzing) {
      throw new Error('Analysis already in progress');
    }

    this.isAnalyzing = true;
    const startTime = performance.now();

    try {
      this.reset();

      // Stage 1: 低解像度での高速スキャン (4fps) - パフォーマンス最適化
      if (onProgress) onProgress(0, 'Fast scan');
      await this.performFastScan(video, onProgress);

      // Stage 2: 検出されたシュート周辺の詳細分析 (12fps) - パフォーマンス最適化
      if (onProgress) onProgress(0.35, 'Detailed analysis');
      await this.performDetailedAnalysis(video, onProgress);

      // Stage 3: 軌道最適化と最終判定
      if (onProgress) onProgress(0.8, 'Trajectory optimization');
      this.optimizeTrajectories();

      const processingTime = performance.now() - startTime;
      const shots = this.trajectoryAnalyzer.getAllShots();

      if (onProgress) onProgress(1, 'Complete');

      return this.createAnalysisResult(
        shots,
        Math.floor(video.duration * this.config.analysisFrameRate),
        this.analysisFrames.length,
        processingTime
      );

    } finally {
      this.isAnalyzing = false;
    }
  }

  private async performFastScan(
    video: HTMLVideoElement,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<void> {
    const duration = video.duration;
    const fastScanRate = 4; // パフォーマンス最適化: 5→4fps
    const frameInterval = 1 / fastScanRate;
    const totalFrames = Math.floor(duration * fastScanRate);
    let processedFrames = 0;

    // パフォーマンス最適化されたバッチサイズ
    const batchSize = this.performanceOptimizer.getOptimalBatchSize();
    const batches = Math.ceil(totalFrames / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      const batchPromises = [];
      const batchStart = batch * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, totalFrames);

      for (let i = batchStart; i < batchEnd; i++) {
        const time = i * frameInterval;
        if (time >= duration) break;

        batchPromises.push(
          this.detector.analyzeVideoFrame(video, time)
            .then(frame => {
              if (frame.ballPosition && frame.ballPosition.confidence > this.config.ballConfidenceThreshold) {
                this.analysisFrames.push(frame);
                this.trajectoryAnalyzer.addBallPosition(frame.ballPosition);
              }
              processedFrames++;
              return frame;
            })
            .catch(error => {
              console.warn(`Fast scan failed at ${time}s:`, error);
              processedFrames++;
              return null;
            })
        );
      }

      // バッチを並列処理（ただしメモリ使用量を制限）
      await Promise.all(batchPromises);
      
      // パフォーマンス監視とメモリ最適化
      this.performanceOptimizer.optimizeResourceUsage();
      
      if (onProgress) {
        onProgress(0.35 * (processedFrames / totalFrames), 'Fast scan');
      }
    }
  }

  private async performDetailedAnalysis(
    video: HTMLVideoElement,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<void> {
    const potentialShots = this.trajectoryAnalyzer.getCurrentShots();
    const detailedFrameRate = 12; // パフォーマンス最適化: 15→12fps
    let processedRegions = 0;

    // 詳細分析する領域を最適化（重複を除去）
    const analysisRegions = this.optimizeAnalysisRegions(potentialShots, video.duration);

    for (const region of analysisRegions) {
      const frameInterval = 1 / detailedFrameRate;
      const regionFrames = [];

      for (let time = region.start; time <= region.end; time += frameInterval) {
        regionFrames.push(time);
      }

      // パフォーマンス最適化された並列処理
      const concurrency = this.performanceOptimizer.getOptimalConcurrency();
      for (let i = 0; i < regionFrames.length; i += concurrency) {
        const batch = regionFrames.slice(i, i + concurrency);
        
        const batchPromises = batch.map(async time => {
          try {
            const frame = await this.detector.analyzeVideoFrame(video, time);
            
            if (frame.ballPosition && frame.ballPosition.confidence > this.config.ballConfidenceThreshold) {
              this.trajectoryAnalyzer.addBallPosition(frame.ballPosition);
              // メモリ最適化：フレームデータは必要最小限のみ保存
              this.analysisFrames.push({
                ...frame,
                detections: frame.detections.filter(d => d.score > 0.5) // 低スコア検出を除去
              });
            }
          } catch (error) {
            console.warn(`Detailed analysis failed at ${time}s:`, error);
          }
        });

        await Promise.all(batchPromises);
      }

      processedRegions++;
      
      if (onProgress) {
        const progress = 0.35 + 0.45 * (processedRegions / analysisRegions.length);
        onProgress(progress, 'Detailed analysis');
      }
    }
  }

  // 分析領域の最適化（重複除去・統合）
  private optimizeAnalysisRegions(shots: ShotEvent[], videoDuration: number) {
    if (shots.length === 0) return [];

    const regions = shots.map(shot => ({
      start: Math.max(0, shot.startTime - 0.8), // 1秒→0.8秒に最適化
      end: Math.min(videoDuration, shot.endTime + 0.8)
    }));

    // 重複する領域を統合
    const mergedRegions = [];
    let currentRegion = regions[0];

    for (let i = 1; i < regions.length; i++) {
      const nextRegion = regions[i];
      
      if (currentRegion.end >= nextRegion.start - 0.5) {
        // 重複または近接している場合は統合
        currentRegion.end = Math.max(currentRegion.end, nextRegion.end);
      } else {
        mergedRegions.push(currentRegion);
        currentRegion = nextRegion;
      }
    }
    
    mergedRegions.push(currentRegion);
    return mergedRegions;
  }

  private optimizeTrajectories(): void {
    // 軌道データの平滑化と精度向上処理
    const allShots = this.trajectoryAnalyzer.getAllShots();
    
    allShots.forEach(shot => {
      // 軌道データの異常値除去
      shot.trajectory = this.removeOutliers(shot.trajectory);
      
      // 軌道の平滑化
      shot.trajectory = this.smoothTrajectory(shot.trajectory);
      
      // 信頼度の再計算
      shot.confidence = this.recalculateConfidence(shot);
    });
  }

  private removeOutliers(trajectory: TrajectoryPoint[]): TrajectoryPoint[] {
    if (trajectory.length < 5) return trajectory;
    
    // 速度ベースの異常値検出
    const velocities = trajectory.slice(1).map((point, i) => {
      const prev = trajectory[i];
      const dt = point.position.timestamp - prev.position.timestamp;
      return {
        index: i + 1,
        speed: dt > 0 ? Math.sqrt(
          Math.pow(point.position.x - prev.position.x, 2) + 
          Math.pow(point.position.y - prev.position.y, 2)
        ) / dt : 0
      };
    });
    
    const meanSpeed = velocities.reduce((sum, v) => sum + v.speed, 0) / velocities.length;
    const threshold = meanSpeed * 3; // 3倍以上は異常値とみなす
    
    return trajectory.filter((_, i) => {
      if (i === 0) return true;
      const velocity = velocities.find(v => v.index === i);
      return !velocity || velocity.speed <= threshold;
    });
  }

  private smoothTrajectory(trajectory: TrajectoryPoint[]): TrajectoryPoint[] {
    if (trajectory.length < 3) return trajectory;
    
    // 移動平均による平滑化
    const windowSize = 3;
    const smoothed = [...trajectory];
    
    for (let i = 1; i < trajectory.length - 1; i++) {
      const startIdx = Math.max(0, i - Math.floor(windowSize / 2));
      const endIdx = Math.min(trajectory.length, i + Math.floor(windowSize / 2) + 1);
      const window = trajectory.slice(startIdx, endIdx);
      
      const avgX = window.reduce((sum, p) => sum + p.position.x, 0) / window.length;
      const avgY = window.reduce((sum, p) => sum + p.position.y, 0) / window.length;
      
      smoothed[i] = {
        ...smoothed[i],
        position: {
          ...smoothed[i].position,
          x: avgX,
          y: avgY
        }
      };
    }
    
    return smoothed;
  }

  private recalculateConfidence(shot: ShotEvent): number {
    const trajectoryQuality = shot.trajectory.length >= 5 ? 1.0 : shot.trajectory.length / 5;
    const positionConfidence = shot.trajectory.reduce((sum, t) => sum + t.position.confidence, 0) / shot.trajectory.length;
    const durationQuality = Math.min(1.0, shot.endTime - shot.startTime);
    
    return (trajectoryQuality * 0.4 + positionConfidence * 0.4 + durationQuality * 0.2);
  }

  updateConfig(newConfig: Partial<AnalysisConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.detector.updateConfig(this.config);
    this.trajectoryAnalyzer.updateConfig(this.config);
  }

  getConfig(): AnalysisConfig {
    return { ...this.config };
  }

  isAnalysisInProgress(): boolean {
    return this.isAnalyzing;
  }

  reset(): void {
    this.analysisFrames = [];
    this.trajectoryAnalyzer.reset();
  }

  dispose(): void {
    this.detector.dispose();
    this.reset();
  }
}