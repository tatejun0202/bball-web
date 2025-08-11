export type Spot = {
  id: number
  label: string
  x: number  // 0..1 左→右
  y: number  // 0..1 上→下
  is3pt: boolean
}

export const SPOTS: Spot[] = [
  // 外周（コーナー→ウィング→トップ）
  { id:  1, label: 'L Corner 3', x: 0.05, y: 0.85, is3pt: true },
  { id:  2, label: 'L Wing 3',   x: 0.17, y: 0.35, is3pt: true },
  { id:  3, label: 'L 45° Mid',  x: 0.255, y: 0.585, is3pt: false },

  // 中央帯
  { id:  4, label: 'Under Rim', x: 0.500, y: 0.83, is3pt: false },
  { id:  5, label: 'Inside Top', x: 0.500, y: 0.65, is3pt: false },

  // 右側
  { id:  6, label: 'R 45° Mid',  x: 0.745, y: 0.585, is3pt: false },
  { id:  7, label: 'R Wing 3',   x: 0.83, y: 0.35, is3pt: true },
  { id:  8, label: 'R Corner 3', x: 0.95, y: 0.85, is3pt: true },

  // トップ
  { id:  9, label: 'Top 3',      x: 0.500, y: 0.17, is3pt: true },
  { id: 10, label: 'Deep Top 3',   x: 0.500, y: 0.05, is3pt: true },

  // 追加ポイント（必要なら）
  { id: 11, label: 'L High Mid',   x: 0.33, y: 0.435, is3pt: true },
  { id: 12, label: 'R High Mid',   x: 0.67, y: 0.435, is3pt: true },
  { id: 13, label: 'FreeThrow',  x: 0.500, y: 0.42, is3pt: false },
  { id: 14, label: 'Inside L',   x: 0.32, y: 0.83, is3pt: false },
  { id: 15, label: 'Inside R',  x: 0.68, y: 0.83, is3pt: false },
]
