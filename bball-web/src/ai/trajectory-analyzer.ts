import type { 
  BallPosition, 
  TrajectoryPoint, 
  ShotEvent, 
  AnalysisConfig 
} from './types';

export class TrajectoryAnalyzer {
  private trajectoryHistory: BallPosition[] = [];
  private currentShots: Map<string, ShotEvent> = new Map();
  private completedShots: ShotEvent[] = [];
  private shotCounter = 0;
  
  private config: AnalysisConfig = {
    frameRate: 30,
    analysisFrameRate: 10,
    ballConfidenceThreshold: 0.3,
    trajectoryHistorySeconds: 3,
    shotMinimumDuration: 0.5,
    shotMaximumDuration: 5,
    goalAreaThreshold: 0.7,
    parabolicThreshold: 0.8
  };

  constructor(config?: Partial<AnalysisConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  addBallPosition(position: BallPosition): void {
    this.trajectoryHistory.push(position);
    this.cleanOldPositions(position.timestamp);
    this.updateTrajectoryAnalysis();
  }

  private cleanOldPositions(currentTime: number): void {
    const cutoffTime = currentTime - this.config.trajectoryHistorySeconds;
    this.trajectoryHistory = this.trajectoryHistory.filter(
      pos => pos.timestamp >= cutoffTime
    );
  }

  private updateTrajectoryAnalysis(): void {
    if (this.trajectoryHistory.length < 3) return;

    const trajectoryPoints = this.calculateTrajectoryPoints();
    const shotCandidates = this.detectShotCandidates(trajectoryPoints);
    
    this.processShotCandidates(shotCandidates);
    this.updateExistingShots(trajectoryPoints);
    this.finalizeCompletedShots();
  }

  private calculateTrajectoryPoints(): TrajectoryPoint[] {
    const points: TrajectoryPoint[] = [];
    
    for (let i = 1; i < this.trajectoryHistory.length - 1; i++) {
      const prev = this.trajectoryHistory[i - 1];
      const curr = this.trajectoryHistory[i];
      const next = this.trajectoryHistory[i + 1];
      
      const dt1 = curr.timestamp - prev.timestamp;
      const dt2 = next.timestamp - curr.timestamp;
      
      if (dt1 > 0 && dt2 > 0) {
        const vx = (curr.x - prev.x) / dt1;
        const vy = (curr.y - prev.y) / dt1;
        
        const ax = ((next.x - curr.x) / dt2 - vx) / dt2;
        const ay = ((next.y - curr.y) / dt2 - vy) / dt2;
        
        points.push({
          position: curr,
          velocity: { x: vx, y: vy },
          acceleration: { x: ax, y: ay }
        });
      }
    }
    
    return points;
  }

  private detectShotCandidates(trajectoryPoints: TrajectoryPoint[]): TrajectoryPoint[] {
    return trajectoryPoints.filter(point => {
      if (!point.velocity) return false;
      
      const speed = Math.sqrt(point.velocity.x ** 2 + point.velocity.y ** 2);
      const isUpward = point.velocity.y < 0; // Y軸は下向きが正の場合
      const isSignificantMovement = speed > 0.1;
      
      return isUpward && isSignificantMovement;
    });
  }

  private processShotCandidates(candidates: TrajectoryPoint[]): void {
    candidates.forEach(candidate => {
      const existingShot = this.findRelevantShot(candidate.position);
      
      if (!existingShot) {
        this.createNewShot(candidate);
      }
    });
  }

  private findRelevantShot(position: BallPosition): ShotEvent | undefined {
    const maxTimeGap = 0.5; // 0.5秒以内の関連ショット
    
    return Array.from(this.currentShots.values()).find(shot => {
      const lastPoint = shot.trajectory[shot.trajectory.length - 1];
      const timeGap = Math.abs(position.timestamp - lastPoint.position.timestamp);
      const distance = this.calculateDistance(position, lastPoint.position);
      
      return timeGap <= maxTimeGap && distance <= 0.2; // 画面の20%以内
    });
  }

  private calculateDistance(pos1: BallPosition, pos2: BallPosition): number {
    return Math.sqrt((pos1.x - pos2.x) ** 2 + (pos1.y - pos2.y) ** 2);
  }

  private createNewShot(candidate: TrajectoryPoint): void {
    const shotId = `shot_${++this.shotCounter}_${Date.now()}`;
    
    const newShot: ShotEvent = {
      id: shotId,
      startTime: candidate.position.timestamp,
      endTime: candidate.position.timestamp,
      trajectory: [candidate],
      outcome: 'unknown',
      confidence: candidate.position.confidence,
      goalDirection: this.isMovingTowardGoal(candidate)
    };
    
    this.currentShots.set(shotId, newShot);
  }

  private updateExistingShots(trajectoryPoints: TrajectoryPoint[]): void {
    trajectoryPoints.forEach(point => {
      const relevantShot = this.findRelevantShot(point.position);
      
      if (relevantShot) {
        relevantShot.trajectory.push(point);
        relevantShot.endTime = point.position.timestamp;
        relevantShot.confidence = (relevantShot.confidence + point.position.confidence) / 2;
        
        // ピーク検出
        if (!relevantShot.peak || point.position.y < relevantShot.peak.y) {
          relevantShot.peak = point.position;
        }
        
        // ゴール方向判定更新
        relevantShot.goalDirection = this.isMovingTowardGoal(point);
      }
    });
  }

  private isMovingTowardGoal(point: TrajectoryPoint): boolean {
    if (!point.velocity) return false;
    
    // ゴールエリアを画面上部中央と仮定
    const goalAreaX = 0.5; // 画面中央
    const goalAreaY = 0.1; // 画面上部
    
    const toGoalX = goalAreaX - point.position.x;
    const toGoalY = goalAreaY - point.position.y;
    
    // 速度ベクトルがゴール方向を向いているか
    const dotProduct = point.velocity.x * toGoalX + point.velocity.y * toGoalY;
    return dotProduct > 0;
  }

  private finalizeCompletedShots(): void {
    const currentTime = this.trajectoryHistory.length > 0 
      ? this.trajectoryHistory[this.trajectoryHistory.length - 1].timestamp 
      : Date.now();
    
    Array.from(this.currentShots.entries()).forEach(([id, shot]) => {
      const shotDuration = shot.endTime - shot.startTime;
      const timeSinceLastUpdate = currentTime - shot.endTime;
      
      // ショット完了判定
      if (shotDuration >= this.config.shotMinimumDuration && 
          (shotDuration >= this.config.shotMaximumDuration || timeSinceLastUpdate > 1.0)) {
        
        // 結果判定
        shot.outcome = this.determineShotOutcome(shot);
        
        // パラボラ品質評価
        shot.confidence *= this.calculateParabolicQuality(shot);
        
        this.completedShots.push(shot);
        this.currentShots.delete(id);
      }
    });
  }

  private determineShotOutcome(shot: ShotEvent): 'made' | 'missed' | 'unknown' {
    if (!shot.goalDirection) return 'missed';
    
    const lastPoint = shot.trajectory[shot.trajectory.length - 1];
    if (!lastPoint) return 'unknown';
    
    const endPosition = lastPoint.position;
    
    // ゴールエリア判定 (画面上部中央)
    const isInGoalArea = 
      endPosition.x >= 0.3 && endPosition.x <= 0.7 && 
      endPosition.y <= this.config.goalAreaThreshold;
    
    // 下向き速度で終了している場合（ゴールに向かう）
    const isDescending = lastPoint.velocity && lastPoint.velocity.y > 0;
    
    if (isInGoalArea && isDescending) {
      return 'made';
    } else if (shot.goalDirection) {
      return 'missed';
    }
    
    return 'unknown';
  }

  private calculateParabolicQuality(shot: ShotEvent): number {
    if (shot.trajectory.length < 5) return 0.5;
    
    // 放物線フィッティング品質評価
    const points = shot.trajectory.map(t => ({ 
      x: t.position.timestamp, 
      y: t.position.y 
    }));
    
    const parabolicFit = this.fitParabola(points);
    return Math.max(0.1, Math.min(1.0, parabolicFit.r2));
  }

  private fitParabola(points: { x: number; y: number }[]): { a: number; b: number; c: number; r2: number } {
    if (points.length < 3) return { a: 0, b: 0, c: 0, r2: 0 };
    
    // 最小二乗法による二次関数フィッティング
    const n = points.length;
    let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0;
    let sumY = 0, sumXY = 0, sumX2Y = 0;
    
    points.forEach(p => {
      const x = p.x;
      const y = p.y;
      sumX += x;
      sumX2 += x * x;
      sumX3 += x * x * x;
      sumX4 += x * x * x * x;
      sumY += y;
      sumXY += x * y;
      sumX2Y += x * x * y;
    });
    
    // 行列計算（簡略化）
    const denominator = n * sumX2 * sumX4 - sumX2 * sumX2 * sumX2;
    if (Math.abs(denominator) < 1e-10) return { a: 0, b: 0, c: 0, r2: 0 };
    
    const a = (n * sumX2Y - sumX2 * sumY) / (n * sumX4 - sumX2 * sumX2);
    const b = (sumXY - a * sumX3) / sumX2;
    const c = (sumY - a * sumX2 - b * sumX) / n;
    
    // R²計算
    const meanY = sumY / n;
    let totalSumSquares = 0;
    let residualSumSquares = 0;
    
    points.forEach(p => {
      const predicted = a * p.x * p.x + b * p.x + c;
      totalSumSquares += (p.y - meanY) ** 2;
      residualSumSquares += (p.y - predicted) ** 2;
    });
    
    const r2 = totalSumSquares > 0 ? 1 - (residualSumSquares / totalSumSquares) : 0;
    
    return { a, b, c, r2: Math.max(0, Math.min(1, r2)) };
  }

  getCompletedShots(): ShotEvent[] {
    return [...this.completedShots];
  }

  getCurrentShots(): ShotEvent[] {
    return Array.from(this.currentShots.values());
  }

  getAllShots(): ShotEvent[] {
    return [...this.completedShots, ...this.getCurrentShots()];
  }

  getTrajectoryHistory(): BallPosition[] {
    return [...this.trajectoryHistory];
  }

  reset(): void {
    this.trajectoryHistory = [];
    this.currentShots.clear();
    this.completedShots = [];
    this.shotCounter = 0;
  }

  updateConfig(newConfig: Partial<AnalysisConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): AnalysisConfig {
    return { ...this.config };
  }
}