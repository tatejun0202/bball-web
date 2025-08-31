# Basketball Analysis Server

Flask + OpenCV ベースのバスケットボール動画解析API

## 機能
- フレーム単位でのバスケットボール検出
- シュート軌道の追跡・解析
- 成功/失敗の自動判定
- 座標の正規化

## Railway デプロイ手順

### 1. Railway CLI インストール
```bash
npm install -g @railway/cli
```

### 2. Railway ログイン
```bash
railway login
```

### 3. プロジェクト作成・デプロイ
```bash
cd railway-server
railway init
railway up
```

### 4. 環境変数設定
Railway のダッシュボードで以下を設定：
- `PORT`: 8000

## ローカル開発

### 依存関係インストール
```bash
pip install -r requirements.txt
```

### サーバー起動
```bash
python app.py
```

## API エンドポイント

### GET `/`
ヘルスチェック

### POST `/analyze`
フレーム解析

リクエスト形式:
```json
{
  "frames": [
    {
      "timestamp": 0,
      "data": "data:image/jpeg;base64,/9j/4AAQ...",
      "width": 480,
      "height": 270
    }
  ],
  "metadata": {
    "targetFps": 2,
    "originalDuration": 60
  }
}
```

レスポンス形式:
```json
{
  "shots": [
    {
      "timestamp": 1500,
      "position": {"x": 0.5, "y": 0.3},
      "result": "make",
      "confidence": 0.75
    }
  ],
  "summary": {
    "total_attempts": 5,
    "makes": 3,
    "misses": 2,
    "fg_percentage": 60.0
  }
}
```

### GET `/test`
テスト用エンドポイント（OpenCV動作確認）