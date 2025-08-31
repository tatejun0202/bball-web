# Railway Basketball Analysis Server
# Flask + OpenCV Basketball Shot Detection API

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import cv2
import numpy as np
import base64
import tempfile
import os
import json
from datetime import datetime
import traceback
from typing import List, Dict, Any

app = Flask(__name__)
CORS(app)  # すべてのオリジンからのアクセスを許可

# 設定
MAX_FRAME_BUFFER = 100  # メモリ制限のため最大100フレーム
BASKETBALL_COLOR_RANGE = {
    'lower': np.array([10, 50, 50]),   # オレンジ色の下限(HSV)
    'upper': np.array([25, 255, 255])  # オレンジ色の上限(HSV)
}

class BasketballTracker:
    def __init__(self):
        self.trajectory = []
        self.last_position = None
        self.shot_threshold = 30  # ピクセル単位での最小移動距離
        self.shots = []
        
    def update(self, position: tuple, timestamp: float):
        """ボール位置を更新し、軌道を追跡"""
        if position is None:
            return
            
        self.trajectory.append({
            'position': position,
            'timestamp': timestamp,
            'x': position[0],
            'y': position[1]
        })
        
        # 軌道バッファサイズ制限
        if len(self.trajectory) > 50:
            self.trajectory.pop(0)
            
        self.last_position = position
    
    def detect_shot(self) -> bool:
        """シュート動作を検出"""
        if len(self.trajectory) < 5:
            return False
            
        # 最近の5フレームの軌道を分析
        recent_trajectory = self.trajectory[-5:]
        
        # Y座標の変化を分析（上向き→下向きの変化点を検出）
        y_changes = []
        for i in range(1, len(recent_trajectory)):
            y_change = recent_trajectory[i]['y'] - recent_trajectory[i-1]['y']
            y_changes.append(y_change)
        
        # 上向き（負の変化）から下向き（正の変化）への転換点を検出
        for i in range(1, len(y_changes)):
            if y_changes[i-1] < -self.shot_threshold and y_changes[i] > self.shot_threshold:
                return True
                
        return False
    
    def analyze_shot_outcome(self, peak_position: tuple) -> str:
        """シュートの成功/失敗を判定"""
        # 簡易的なゴール判定（実装を簡略化）
        # 実際の実装では、ゴール位置との関係を詳細に分析
        peak_x, peak_y = peak_position
        
        # 画面上部中央付近をゴールエリアと仮定
        goal_area_x = (200, 280)  # 480px幅の中央付近
        goal_area_y = (50, 120)   # 上部エリア
        
        if (goal_area_x[0] <= peak_x <= goal_area_x[1] and 
            goal_area_y[0] <= peak_y <= goal_area_y[1]):
            return 'make'
        else:
            return 'miss'

def detect_basketball_in_frame(frame) -> tuple:
    """フレーム内でバスケットボールを検出"""
    try:
        # HSV色空間に変換
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        
        # オレンジ色をマスク
        mask = cv2.inRange(hsv, BASKETBALL_COLOR_RANGE['lower'], BASKETBALL_COLOR_RANGE['upper'])
        
        # ノイズ除去
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3,3), np.uint8))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3,3), np.uint8))
        
        # 円形検出
        circles = cv2.HoughCircles(mask, cv2.HOUGH_GRADIENT, 1, 20,
                                   param1=50, param2=30, minRadius=5, maxRadius=50)
        
        if circles is not None:
            circles = np.round(circles[0, :]).astype("int")
            # 最も大きな円を選択
            if len(circles) > 0:
                largest_circle = max(circles, key=lambda c: c[2])  # 半径で比較
                return (int(largest_circle[0]), int(largest_circle[1]))
        
        # 円形検出に失敗した場合、輪郭検出を試行
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if contours:
            # 最大面積の輪郭を選択
            largest_contour = max(contours, key=cv2.contourArea)
            if cv2.contourArea(largest_contour) > 100:  # 最小面積閾値
                M = cv2.moments(largest_contour)
                if M["m00"] != 0:
                    cx = int(M["m10"] / M["m00"])
                    cy = int(M["m01"] / M["m00"])
                    return (cx, cy)
        
        return None
        
    except Exception as e:
        print(f"Ball detection error: {e}")
        return None

def base64_to_opencv_image(base64_string: str):
    """Base64文字列をOpenCV画像に変換"""
    try:
        # データURL形式の場合、データ部分のみ抽出
        if base64_string.startswith('data:image'):
            base64_string = base64_string.split(',')[1]
        
        # Base64デコード
        image_data = base64.b64decode(base64_string)
        
        # numpy配列に変換
        nparr = np.frombuffer(image_data, np.uint8)
        
        # OpenCV画像としてデコード
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        return image
        
    except Exception as e:
        print(f"Base64 conversion error: {e}")
        return None

@app.route('/', methods=['GET'])
def health_check():
    """ヘルスチェックエンドポイント"""
    return jsonify({
        'status': 'ok',
        'message': 'Basketball Analysis Server is running',
        'version': '1.0.0',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/analyze', methods=['POST'])
def analyze_frames():
    """フレーム解析メインエンドポイント"""
    try:
        # リクエストデータの検証
        if not request.json or 'frames' not in request.json:
            return jsonify({'error': 'No frames data provided'}), 400
        
        frames_data = request.json['frames']
        metadata = request.json.get('metadata', {})
        
        print(f"Analyzing {len(frames_data)} frames...")
        
        # バスケットボール追跡初期化
        tracker = BasketballTracker()
        detected_shots = []
        
        # フレーム解析
        for i, frame_info in enumerate(frames_data):
            try:
                # Base64画像をOpenCV形式に変換
                frame = base64_to_opencv_image(frame_info['data'])
                if frame is None:
                    continue
                
                # バスケットボール検出
                ball_position = detect_basketball_in_frame(frame)
                
                # 追跡更新
                timestamp = frame_info.get('timestamp', i * 500)  # 500ms間隔と仮定
                tracker.update(ball_position, timestamp)
                
                # シュート検出
                if tracker.detect_shot():
                    peak_position = tracker.last_position
                    if peak_position:
                        outcome = tracker.analyze_shot_outcome(peak_position)
                        
                        shot_data = {
                            'timestamp': timestamp,
                            'position': {
                                'x': peak_position[0] / frame_info['width'],  # 正規化座標
                                'y': peak_position[1] / frame_info['height']
                            },
                            'result': outcome,
                            'confidence': 0.75,  # 固定値（実装簡略化）
                            'frame_index': i
                        }
                        
                        detected_shots.append(shot_data)
                        print(f"Shot detected at frame {i}: {outcome}")
                
            except Exception as frame_error:
                print(f"Frame {i} processing error: {frame_error}")
                continue
        
        # 結果サマリー
        total_attempts = len(detected_shots)
        makes = sum(1 for shot in detected_shots if shot['result'] == 'make')
        misses = total_attempts - makes
        
        result = {
            'shots': detected_shots,
            'summary': {
                'total_attempts': total_attempts,
                'makes': makes,
                'misses': misses,
                'fg_percentage': (makes / total_attempts * 100) if total_attempts > 0 else 0
            },
            'metadata': {
                'frames_processed': len(frames_data),
                'processing_time': datetime.now().isoformat(),
                **metadata
            }
        }
        
        print(f"Analysis complete: {total_attempts} shots detected ({makes} makes, {misses} misses)")
        
        return jsonify(result)
        
    except Exception as e:
        error_info = {
            'error': 'Analysis failed',
            'message': str(e),
            'traceback': traceback.format_exc()
        }
        print(f"Analysis error: {error_info}")
        return jsonify(error_info), 500

@app.route('/test', methods=['GET'])
def test_endpoint():
    """テスト用エンドポイント"""
    return jsonify({
        'message': 'Test endpoint working',
        'opencv_version': cv2.__version__,
        'numpy_version': np.__version__
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port, debug=False)