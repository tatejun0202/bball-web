'use client'
import { useMemo } from 'react'
import { SPOTS } from '@/constants/spots'

type Props = {
  width?: number
  activeId?: number
  onSelect?: (id: number) => void
  flipY?: boolean   // ★追加：上下反転
}

const IMG_W = 1095
const IMG_H = 768
const RATIO = IMG_H / IMG_W

export default function CourtImageSpots({ width = 360, activeId, onSelect, flipY }: Props) {
  const height = useMemo(() => Math.round(width * RATIO), [width])

  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        margin: '12px auto',
        border: '1px solid #3a3a3a',
        borderRadius: 8,
        overflow: 'hidden',
        transform: flipY ? 'scaleY(-1)' : undefined,      // ★反転
        transformOrigin: 'center',
      }}
    >
      <img
        src="/court.png"
        alt="court"
        draggable={false}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
      />
      {SPOTS.map(s => (
      <button
        key={s.id}
        onClick={() => onSelect?.(s.id)}
        aria-label={s.label}
        style={{
          position: 'absolute',
          left: `${s.x * 100}%`,
          top: `${s.y * 100}%`,
          transform: 'translate(-50%, -50%)',
          // ▼ 判定を広く（視覚は丸く保つ）
          width: 28, height: 28,            // ← 24〜32 お好みで
          borderRadius: '50%',
          background: 'transparent',        // 透明ヒット枠
          border: 'none',
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation',
        }}
      >
        {/* 見た目の丸（小さめ） */}
        <span
          style={{
            display: 'block',
            width: 16, height: 16,          // ← 可視サイズは従来のまま
            margin: '7px',                   // （28-14）/2 で中央に
            borderRadius: '50%',
            background: s.id === activeId ? '#ff914d' : '#6ec1ff',
            border: '1px solid #000',
            boxShadow: s.id === activeId ? '0 0 0 3px rgba(255,145,77,.25)' : 'none',
            pointerEvents: 'none',
          }}
        />
      </button>
    ))}
    </div>
  )
}
