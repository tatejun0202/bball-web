// src/components/CourtImageSpots.tsx
'use client'
import Image from 'next/image'
import { SPOTS } from '@/constants/spots'

type Props = {
  width?: number          // 表示幅(px)
  activeId?: number
  onSelect?: (id: number) => void
  flipY?: boolean         // 画像＆座標を上下反転
}

// 提供いただいた court.png の実寸比（横/縦）
const COURT_RATIO = 1095 / 768   // ≒ 1.426（= 横が1.426倍）

export default function CourtImageSpots({ width = 340, activeId, onSelect, flipY = false }: Props) {
  return (
    <div style={{ width, margin: '0 auto' }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: COURT_RATIO, // ★ 画像の実寸比で枠を作る
          overflow: 'hidden',       // ★ はみ出し防止
          border: '1px solid #dcdcdc',
          borderRadius: 2,
          background: '#1c1c1c'
        }}
      >
        <Image
          src="/court.png"
          alt="court"
          fill
          priority
          sizes="(max-width: 430px) 100vw, 430px"
          style={{
            objectFit: 'contain',                // ★ 引き伸ばさず収める
            transform: flipY ? 'scaleY(-1)' : '',// ★ 画像も上下反転
            pointerEvents: 'none'                // タップをスポットに通す
          }}
        />

        {SPOTS.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect?.(s.id)}
            aria-label={s.label}
            style={{
              position: 'absolute',
              left: `${s.x * 100}%`,
              top: `${(flipY ? (1 - s.y) : s.y) * 100}%`, // ★ 座標も反転
              transform: 'translate(-50%, -50%)',
              width: 36, height: 36,               // ヒット領域広め
              borderRadius: '50%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
              zIndex: 2                            // ★ 画像より前面に
            }}
          >
            <span
              style={{
                display: 'block',
                width: 14, height: 14, margin: '11px', // (36-14)/2
                borderRadius: '50%',
                background: s.id === activeId ? '#ff914d' : '#6ec1ff',
                border: '1px solid #000',
                boxShadow: s.id === activeId ? '0 0 0 3px rgba(255,145,77,.25)' : 'none',
                pointerEvents: 'none'
              }}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
