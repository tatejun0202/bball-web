// src/components/FreePositionCourt.tsx
'use client'
import Image from 'next/image'
import { useState, useRef } from 'react'
import { SPOTS } from '@/constants/spots'
import { detectArea, getAreaName } from '@/constants/court-areas'
import type { PositionInfo } from '@/db/types'

type Props = {
  width?: number
  mode?: 'select' | 'display'                    // 選択モード or 表示のみ
  positions?: PositionInfo[]                     // 表示する位置情報
  selectedPosition?: PositionInfo | null         // 選択中の位置
  onPositionSelect?: (position: PositionInfo) => void  // 位置選択時のコールバック
  onFreePosition?: (x: number, y: number) => void      // 自由配置時のコールバック
  flipY?: boolean                                // 画像上下反転
  showFixedSpots?: boolean                       // 固定スポットも表示するか
}

const COURT_RATIO = 1095 / 768

export default function FreePositionCourt({ 
  width = 340, 
  mode = 'select',
  positions = [],
  selectedPosition,
  onPositionSelect,
  onFreePosition,
  flipY = false,
  showFixedSpots = true
}: Props) {
  const [previewPosition, setPreviewPosition] = useState<{ x: number; y: number } | null>(null)
  const courtRef = useRef<HTMLDivElement>(null)

  // コート上のクリック/タップ処理
  const handleCourtClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // スポットモード時は自由配置を無効化
    if (mode !== 'select' || showFixedSpots) return
    
    const rect = courtRef.current?.getBoundingClientRect()
    if (!rect) return

    // クリック位置を相対座標に変換
    const relativeX = (event.clientX - rect.left) / rect.width
    const relativeY = (event.clientY - rect.top) / rect.height
    
    // Y座標の反転を考慮
    const actualY = flipY ? 1 - relativeY : relativeY
    
    // 範囲チェック
    if (relativeX < 0 || relativeX > 1 || actualY < 0 || actualY > 1) return

    // 自由配置コールバック
    onFreePosition?.(relativeX, actualY)
  }

  // マウスホバー時のプレビュー
  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    // スポットモード時または選択モードでない場合はプレビュー無効
    if (mode !== 'select' || showFixedSpots) return
    
    const rect = courtRef.current?.getBoundingClientRect()
    if (!rect) return

    const relativeX = (event.clientX - rect.left) / rect.width
    const relativeY = (event.clientY - rect.top) / rect.height
    const actualY = flipY ? 1 - relativeY : relativeY
    
    if (relativeX >= 0 && relativeX <= 1 && actualY >= 0 && actualY <= 1) {
      setPreviewPosition({ x: relativeX, y: actualY })
    } else {
      setPreviewPosition(null)
    }
  }

  const handleMouseLeave = () => {
    setPreviewPosition(null)
  }

  return (
    <div style={{ width, margin: '0 auto' }}>
      {/* コート */}
      <div
        ref={courtRef}
        onClick={handleCourtClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: COURT_RATIO,
          overflow: 'hidden',
          border: '1px solid #dcdcdc',
          borderRadius: 8,
          background: '#1c1c1c',
          cursor: mode === 'select' ? 'crosshair' : 'default'
        }}
      >
        {/* コート画像 */}
        <Image
          src="/court.png"
          alt="court"
          fill
          priority
          sizes="(max-width: 430px) 100vw, 430px"
          style={{
            objectFit: 'contain',
            transform: flipY ? 'scaleY(-1)' : '',
            pointerEvents: 'none'
          }}
        />

        {/* 固定スポット（オプション） */}
        {showFixedSpots && SPOTS.map(spot => (
          <button
            key={`fixed-${spot.id}`}
            onClick={(e) => {
              e.stopPropagation()
              const fixedPosition: PositionInfo = {
                type: 'fixed',
                spotId: spot.id,
                label: spot.label,
                is3pt: spot.is3pt,
                x: spot.x,
                y: spot.y,
                attempts: 0,
                makes: 0,
                fgPercentage: 0
              }
              onPositionSelect?.(fixedPosition)
            }}
            style={{
              position: 'absolute',
              left: `${spot.x * 100}%`,
              top: `${(flipY ? (1 - spot.y) : spot.y) * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
              zIndex: 2
            }}
          >
            <span
              style={{
                display: 'block',
                width: 12,
                height: 12,
                margin: '10px',
                borderRadius: '50%',
                background: (selectedPosition?.type === 'fixed' && selectedPosition?.spotId === spot.id) 
                  ? '#ff914d' : '#6ec1ff',
                border: '1px solid #000',
                boxShadow: (selectedPosition?.type === 'fixed' && selectedPosition?.spotId === spot.id)
                  ? '0 0 0 3px rgba(255,145,77,.25)' : 'none',
                pointerEvents: 'none'
              }}
            />
          </button>
        ))}

        {/* 記録済み位置 */}
        {positions.map((pos, index) => (
          <button
            key={`position-${index}`}
            onClick={(e) => {
              e.stopPropagation()
              onPositionSelect?.(pos)
            }}
            style={{
              position: 'absolute',
              left: `${pos.x * 100}%`,
              top: `${(flipY ? (1 - pos.y) : pos.y) * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: Math.max(16, Math.min(32, pos.attempts * 2 + 16)),
              height: Math.max(16, Math.min(32, pos.attempts * 2 + 16)),
              borderRadius: '50%',
              background: `rgba(${pos.fgPercentage >= 50 ? '34, 197, 94' : '239, 68, 68'}, ${Math.min(pos.attempts / 20 + 0.3, 0.9)})`,
              border: '2px solid rgba(255, 255, 255, 0.8)',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
              zIndex: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              fontWeight: 700,
              color: '#fff',
              textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
            }}
          >
            {pos.fgPercentage.toFixed(0)}%
          </button>
        ))}

        {/* プレビュードット（自由配置モード & 選択中でない場合のみ表示） */}
        {previewPosition && mode === 'select' && !selectedPosition && !showFixedSpots && (
          <div
            style={{
              position: 'absolute',
              left: `${previewPosition.x * 100}%`,
              top: `${(flipY ? (1 - previewPosition.y) : previewPosition.y) * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: 'rgba(110, 193, 255, 0.7)',
              border: '2px solid rgba(255, 255, 255, 0.9)',
              pointerEvents: 'none',
              zIndex: 4,
              animation: 'pulse 1s infinite'
            }}
          />
        )}

        {/* 選択中の位置（オレンジの丸） */}
        {selectedPosition && (
          <div
            style={{
              position: 'absolute',
              left: `${selectedPosition.x * 100}%`,
              top: `${(flipY ? (1 - selectedPosition.y) : selectedPosition.y) * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              pointerEvents: 'none', // クリックイベントを通す
              zIndex: 5
            }}
          >
            <span
              style={{
                display: 'block',
                width: 14,
                height: 14,
                margin: '11px',
                borderRadius: '50%',
                background: '#ff914d', // オレンジ色（選択中）
                border: '1px solid #000',
                boxShadow: '0 0 0 3px rgba(255,145,77,.25)',
                pointerEvents: 'none'
              }}
            />
          </div>
        )}
      </div>

      {/* 選択中位置の情報 */}
      <div style={{
        marginTop: 8,
        fontSize: 16,
        fontWeight: 700,
        color: selectedPosition ? '#ddd' : 'transparent',
        textAlign: 'center',
        minHeight: 24, // 固定高さで下の要素のズレを防ぐ
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
        }}>
        {selectedPosition ? (
            selectedPosition.type === 'fixed' 
            ? selectedPosition.label 
            : getAreaName(selectedPosition.x, selectedPosition.y)
        ) : 'エリアを選択してください'}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.7; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
        }
      `}</style>
    </div>
  )
}