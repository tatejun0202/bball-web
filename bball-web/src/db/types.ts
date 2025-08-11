// src/db/types.ts (拡張版)

// V2: 自由配置対応の結果保存用型
export interface NewDrillResult {
  sessionId: number
  zoneId: number
  attempts: number
  makes: number
  
  // どちらかの位置指定が必要
  position: 
    | { type: 'fixed'; spotId: number }           // 固定スポット
    | { type: 'free'; x: number; y: number }     // 自由配置座標
}

// 表示用の統一された位置情報
export interface PositionInfo {
  type: 'fixed' | 'free'
  // 固定スポットの場合
  spotId?: number
  label?: string
  is3pt?: boolean
  // 自由配置の場合
  x: number        // 0.0-1.0の相対座標
  y: number        // 0.0-1.0の相対座標
  // 共通
  attempts: number
  makes: number
  fgPercentage: number
}

// エリア判定用の型
export interface CourtArea {
  id: string
  name: string
  is3pt: boolean
  // エリアの境界定義（ポリゴンまたは矩形）
  bounds: {
    type: 'polygon' | 'rect'
    points: Array<{ x: number; y: number }>
  }
}

// 座標からエリアを判定する関数の型
export type AreaDetector = (x: number, y: number) => CourtArea | null