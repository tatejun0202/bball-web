// src/constants/court-areas.ts
import type { CourtArea } from '@/db/types'

// バスケットボールコートのエリア定義
// 座標は court.png の画像比率に基づく (0.0-1.0の相対座標)
export const COURT_AREAS: CourtArea[] = [
  // 制限区域 (Restricted Area)
  {
    id: 'restricted',
    name: '制限区域',
    is3pt: false,
    bounds: {
      type: 'rect',
      points: [
        { x: 0.35, y: 0.82 },  // 左上
        { x: 0.65, y: 0.95 }   // 右下
      ]
    }
  },
  
  // 左ベースライン (Left Baseline)
  {
    id: 'left-baseline',
    name: '左ベースライン',
    is3pt: false,
    bounds: {
      type: 'rect',
      points: [
        { x: 0.05, y: 0.82 },
        { x: 0.35, y: 0.95 }
      ]
    }
  },
  
  // 右ベースライン (Right Baseline)
  {
    id: 'right-baseline',
    name: '右ベースライン',
    is3pt: false,
    bounds: {
      type: 'rect',
      points: [
        { x: 0.65, y: 0.82 },
        { x: 0.95, y: 0.95 }
      ]
    }
  },
  
  // 左ミッドレンジ (Left Mid-Range)
  {
    id: 'left-midrange',
    name: '左ミッドレンジ',
    is3pt: false,
    bounds: {
      type: 'rect',
      points: [
        { x: 0.05, y: 0.55 },
        { x: 0.35, y: 0.82 }
      ]
    }
  },
  
  // 右ミッドレンジ (Right Mid-Range)
  {
    id: 'right-midrange',
    name: '右ミッドレンジ',
    is3pt: false,
    bounds: {
      type: 'rect',
      points: [
        { x: 0.65, y: 0.55 },
        { x: 0.95, y: 0.82 }
      ]
    }
  },
  
  // センター (Center)
  {
    id: 'center-midrange',
    name: 'センター',
    is3pt: false,
    bounds: {
      type: 'rect',
      points: [
        { x: 0.35, y: 0.55 },
        { x: 0.65, y: 0.82 }
      ]
    }
  },
  
  // 左コーナー3P (Left Corner 3)
  {
    id: 'left-corner-3',
    name: '左コーナー3P',
    is3pt: true,
    bounds: {
      type: 'rect',
      points: [
        { x: 0.05, y: 0.78 },
        { x: 0.25, y: 0.95 }
      ]
    }
  },
  
  // 右コーナー3P (Right Corner 3)
  {
    id: 'right-corner-3',
    name: '右コーナー3P',
    is3pt: true,
    bounds: {
      type: 'rect',
      points: [
        { x: 0.75, y: 0.78 },
        { x: 0.95, y: 0.95 }
      ]
    }
  },
  
  // 左ウィング3P (Left Wing 3)
  {
    id: 'left-wing-3',
    name: '左ウィング3P',
    is3pt: true,
    bounds: {
      type: 'rect',
      points: [
        { x: 0.15, y: 0.35 },
        { x: 0.35, y: 0.65 }
      ]
    }
  },
  
  // 右ウィング3P (Right Wing 3)
  {
    id: 'right-wing-3',
    name: '右ウィング3P',
    is3pt: true,
    bounds: {
      type: 'rect',
      points: [
        { x: 0.65, y: 0.35 },
        { x: 0.85, y: 0.65 }
      ]
    }
  },
  
  // トップ3P (Top 3)
  {
    id: 'top-3',
    name: 'トップ3P',
    is3pt: true,
    bounds: {
      type: 'rect',
      points: [
        { x: 0.35, y: 0.25 },
        { x: 0.65, y: 0.55 }
      ]
    }
  },
  
  // 左トップ3P (Left Top 3)
  {
    id: 'left-top-3',
    name: '左トップ3P',
    is3pt: true,
    bounds: {
      type: 'rect',
      points: [
        { x: 0.25, y: 0.25 },
        { x: 0.35, y: 0.45 }
      ]
    }
  },
  
  // 右トップ3P (Right Top 3)
  {
    id: 'right-top-3',
    name: '右トップ3P',
    is3pt: true,
    bounds: {
      type: 'rect',
      points: [
        { x: 0.65, y: 0.25 },
        { x: 0.75, y: 0.45 }
      ]
    }
  }
]

// 座標からエリアを判定する関数
export function detectArea(x: number, y: number): CourtArea | null {
  for (const area of COURT_AREAS) {
    if (isPointInArea(x, y, area)) {
      return area
    }
  }
  return null
}

// 点がエリア内にあるかチェック
function isPointInArea(x: number, y: number, area: CourtArea): boolean {
  if (area.bounds.type === 'rect') {
    const [topLeft, bottomRight] = area.bounds.points
    return (
      x >= topLeft.x && x <= bottomRight.x &&
      y >= topLeft.y && y <= bottomRight.y
    )
  }
  
  // polygon の場合（将来的に複雑な形状に対応）
  if (area.bounds.type === 'polygon') {
    return isPointInPolygon(x, y, area.bounds.points)
  }
  
  return false
}

// ポリゴン内判定（レイキャスト法）
function isPointInPolygon(x: number, y: number, polygon: Array<{ x: number; y: number }>): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (
      polygon[i].y > y !== polygon[j].y > y &&
      x < (polygon[j].x - polygon[i].x) * (y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x
    ) {
      inside = !inside
    }
  }
  return inside
}

// デバッグ用: 座標に対応するエリア名を取得
export function getAreaName(x: number, y: number): string {
  const area = detectArea(x, y)
  return area?.name || `フリー位置 (${(x * 100).toFixed(1)}, ${(y * 100).toFixed(1)})`
}