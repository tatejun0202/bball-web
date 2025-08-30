export interface DetectedObject {
  class: string;
  score: number;
  bbox: [number, number, number, number]; // [x, y, width, height] normalized 0-1
}

export interface BallPosition {
  x: number;
  y: number;
  timestamp: number;
  confidence: number;
  frameIndex?: number;
}

export interface TrajectoryPoint {
  position: BallPosition;
  velocity?: { x: number; y: number };
  acceleration?: { x: number; y: number };
}

export interface ShotEvent {
  id: string;
  startTime: number;
  endTime: number;
  trajectory: TrajectoryPoint[];
  outcome: 'made' | 'missed' | 'unknown';
  confidence: number;
  peak?: BallPosition;
  goalDirection: boolean;
}

export interface AnalysisFrame {
  timestamp: number;
  frameIndex: number;
  detections: DetectedObject[];
  ballPosition?: BallPosition;
}

export interface AnalysisResult {
  shots: ShotEvent[];
  totalFrames: number;
  processedFrames: number;
  processingTime: number;
  averageConfidence: number;
  metadata: {
    modelVersion: string;
    analysisDate: string;
    videoPath?: string;
  };
}

export interface AnalysisConfig {
  frameRate: number;
  analysisFrameRate: number;
  ballConfidenceThreshold: number;
  trajectoryHistorySeconds: number;
  shotMinimumDuration: number;
  shotMaximumDuration: number;
  goalAreaThreshold: number;
  parabolicThreshold: number;
}

export interface ModelLoadStatus {
  loaded: boolean;
  loading: boolean;
  error?: string;
  modelName: string;
  loadTime?: number;
}