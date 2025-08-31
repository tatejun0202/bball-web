// public/workers/video-preprocessor.js
// 動画前処理用WebWorker

self.onmessage = async function(e) {
  const { type, data } = e.data
  
  switch (type) {
    case 'PROCESS_VIDEO':
      await processVideo(data)
      break
    default:
      console.warn('Unknown message type:', type)
  }
}

async function processVideo({ videoBlob, options = {} }) {
  try {
    const {
      targetWidth = 480,
      targetHeight = 270,
      targetFps = 2,
      quality = 0.7
    } = options

    // 進捗報告
    self.postMessage({
      type: 'PROGRESS',
      data: { stage: 'initializing', progress: 0 }
    })

    // OffscreenCanvas対応チェック
    if (!self.OffscreenCanvas) {
      throw new Error('OffscreenCanvas not supported')
    }

    // 動画をBlob URLに変換
    const videoUrl = URL.createObjectURL(videoBlob)
    
    // OffscreenCanvasで動画処理
    const canvas = new OffscreenCanvas(targetWidth, targetHeight)
    const ctx = canvas.getContext('2d')
    
    // 動画メタデータ取得（Web Worker内では直接video要素を作成できないため、メインスレッドから取得）
    const frames = await extractFramesFromVideo(videoUrl, {
      targetWidth,
      targetHeight,
      targetFps,
      canvas,
      ctx
    })

    // 進捗報告
    self.postMessage({
      type: 'PROGRESS',
      data: { stage: 'encoding', progress: 80 }
    })

    // Base64エンコード
    const encodedFrames = frames.map(frame => ({
      timestamp: frame.timestamp,
      data: frame.data,
      width: targetWidth,
      height: targetHeight
    }))

    // 完了報告
    self.postMessage({
      type: 'COMPLETE',
      data: {
        frames: encodedFrames,
        originalSize: videoBlob.size,
        processedSize: calculateProcessedSize(encodedFrames),
        frameCount: encodedFrames.length,
        metadata: {
          targetWidth,
          targetHeight,
          targetFps,
          quality
        }
      }
    })

    // クリーンアップ
    URL.revokeObjectURL(videoUrl)

  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      data: { message: error.message, stack: error.stack }
    })
  }
}

async function extractFramesFromVideo(videoUrl, { targetWidth, targetHeight, targetFps, canvas, ctx }) {
  // Web Worker内では直接video要素を扱えないため、
  // ImageBitmapを使用した代替実装
  
  const frames = []
  
  // この部分は実際の実装では、メインスレッドとの連携が必要
  // 現在はプレースホルダーとして基本構造のみ実装
  
  // フレーム抽出のシミュレーション
  const frameInterval = 1000 / targetFps // ミリ秒
  const totalDuration = 60000 // 60秒と仮定
  
  for (let timestamp = 0; timestamp < totalDuration; timestamp += frameInterval) {
    // 進捗更新
    const progress = Math.min((timestamp / totalDuration) * 70, 70) // 70%まで
    self.postMessage({
      type: 'PROGRESS',
      data: { stage: 'extracting', progress }
    })
    
    // 実際の実装ではここでフレームを抽出
    // 現在はダミーデータ
    const frameData = await createDummyFrame(targetWidth, targetHeight, ctx)
    
    frames.push({
      timestamp,
      data: frameData
    })
  }
  
  return frames
}

async function createDummyFrame(width, height, ctx) {
  // ダミーフレーム作成（テスト用）
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#0ea5e9'
  ctx.fillText('Processing...', width/2, height/2)
  
  // ImageDataをBase64に変換
  const imageData = ctx.getImageData(0, 0, width, height)
  const canvas = new OffscreenCanvas(width, height)
  const tempCtx = canvas.getContext('2d')
  tempCtx.putImageData(imageData, 0, 0)
  
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 })
  const arrayBuffer = await blob.arrayBuffer()
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
  
  return `data:image/jpeg;base64,${base64}`
}

function calculateProcessedSize(encodedFrames) {
  return encodedFrames.reduce((total, frame) => {
    // Base64のサイズを概算
    return total + (frame.data.length * 0.75) // Base64は約33%サイズが増加するため
  }, 0)
}