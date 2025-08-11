// src/components/CourtImageSpots.tsx
'use client'
import Image from 'next/image'
import { SPOTS } from '@/constants/spots'

type Props = {
  width?: number
  activeId?: number
  onSelect?: (id: number) => void
  flipY?: boolean
}

export default function CourtImageSpots({ width = 340, activeId, onSelect, flipY = false }: Props) {
  return (
    <div style={{ width, margin: '0 auto' }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '360/640' }}>
        <Image
          src="/court.png"
          alt="court"
          fill
          priority
          sizes="(max-width: 430px) 100vw, 430px"
          style={{ objectFit: 'cover' }}
        />

        {SPOTS.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect?.(s.id)}
            aria-label={s.label}
            style={{
              position: 'absolute',
              left: `${s.x * 100}%`,
              top: `${(flipY ? (1 - s.y) : s.y) * 100}%`, // ★ flipY を実利用
              transform: 'translate(-50%, -50%)',
              width: 32,
              height: 32, // ← ヒット領域を広めに
              borderRadius: '50%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation'
            }}
          >
            <span
              style={{
                display: 'block',
                width: 14,
                height: 14,
                margin: '9px', // (32-14)/2
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
