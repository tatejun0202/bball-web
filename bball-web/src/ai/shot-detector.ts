import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import type { DetectedObject, BallPosition, AnalysisFrame, ModelLoadStatus, AnalysisConfig } from './types';

export class ShotDetector {
  private model: cocoSsd.ObjectDetection | null = null;
  private modelStatus: ModelLoadStatus = {
    loaded: false,
    loading: false,
    modelName: 'COCO-SSD'
  };
  
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

  async loadModel(): Promise<void> {
    if (this.modelStatus.loaded || this.modelStatus.loading) {
      return;
    }

    this.modelStatus.loading = true;
    const startTime = performance.now();

    try {
      await tf.ready();
      this.model = await cocoSsd.load({
        base: 'mobilenet_v2'
      });
      
      const loadTime = performance.now() - startTime;
      this.modelStatus = {
        loaded: true,
        loading: false,
        modelName: 'COCO-SSD MobileNet v2',
        loadTime
      };
      
      console.log(`TensorFlow model loaded in ${loadTime.toFixed(2)}ms`);
    } catch (error) {
      this.modelStatus = {
        loaded: false,
        loading: false,
        modelName: 'COCO-SSD',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      throw error;
    }
  }

  getModelStatus(): ModelLoadStatus {
    return { ...this.modelStatus };
  }

  async detectObjects(
    imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    timestamp: number,
    frameIndex?: number
  ): Promise<AnalysisFrame> {
    if (!this.model) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    try {
      const predictions = await this.model.detect(imageElement);
      
      const detections: DetectedObject[] = predictions.map(pred => ({
        class: pred.class,
        score: pred.score,
        bbox: [
          pred.bbox[0] / imageElement.width,
          pred.bbox[1] / imageElement.height,
          pred.bbox[2] / imageElement.width,
          pred.bbox[3] / imageElement.height
        ]
      }));

      const ballPosition = this.extractBallPosition(detections, timestamp, frameIndex);

      return {
        timestamp,
        frameIndex: frameIndex || 0,
        detections,
        ballPosition
      };
    } catch (error) {
      console.error('Detection error:', error);
      return {
        timestamp,
        frameIndex: frameIndex || 0,
        detections: []
      };
    }
  }

  private extractBallPosition(
    detections: DetectedObject[],
    timestamp: number,
    frameIndex?: number
  ): BallPosition | undefined {
    const ballCandidates = detections.filter(det => 
      this.isBallLikeObject(det.class) && det.score >= this.config.ballConfidenceThreshold
    );

    if (ballCandidates.length === 0) {
      return undefined;
    }

    const bestCandidate = ballCandidates.reduce((best, current) => 
      current.score > best.score ? current : best
    );

    const centerX = bestCandidate.bbox[0] + bestCandidate.bbox[2] / 2;
    const centerY = bestCandidate.bbox[1] + bestCandidate.bbox[3] / 2;

    return {
      x: centerX,
      y: centerY,
      timestamp,
      confidence: bestCandidate.score,
      frameIndex
    };
  }

  private isBallLikeObject(className: string): boolean {
    const ballClasses = [
      'sports ball',
      'baseball',
      'basketball',
      'tennis ball',
      'ball'
    ];
    return ballClasses.includes(className.toLowerCase());
  }

  async detectFromCanvas(
    canvas: HTMLCanvasElement,
    timestamp: number,
    frameIndex?: number
  ): Promise<AnalysisFrame> {
    return this.detectObjects(canvas, timestamp, frameIndex);
  }

  async detectFromVideo(
    video: HTMLVideoElement,
    timestamp?: number,
    frameIndex?: number
  ): Promise<AnalysisFrame> {
    const currentTime = timestamp !== undefined ? timestamp : video.currentTime;
    const currentFrame = frameIndex !== undefined ? frameIndex : 
      Math.floor(currentTime * this.config.frameRate);
    
    return this.detectObjects(video, currentTime, currentFrame);
  }

  async analyzeVideoFrame(
    video: HTMLVideoElement,
    frameTime: number
  ): Promise<AnalysisFrame> {
    return new Promise((resolve, reject) => {
      const originalTime = video.currentTime;
      
      video.currentTime = frameTime;
      
      const onSeeked = async () => {
        try {
          const result = await this.detectFromVideo(video, frameTime);
          video.currentTime = originalTime;
          video.removeEventListener('seeked', onSeeked);
          resolve(result);
        } catch (error) {
          video.removeEventListener('seeked', onSeeked);
          reject(error);
        }
      };
      
      video.addEventListener('seeked', onSeeked);
    });
  }

  updateConfig(newConfig: Partial<AnalysisConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): AnalysisConfig {
    return { ...this.config };
  }

  dispose(): void {
    if (this.model) {
      this.model.dispose?.();
      this.model = null;
    }
    this.modelStatus = {
      loaded: false,
      loading: false,
      modelName: 'COCO-SSD'
    };
  }
}