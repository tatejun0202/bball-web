// src/hooks/useHorizontalSwipe.ts (修正版)
'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

// 画面の順序定義
const SCREEN_ORDER = ['/session', '/history', '/stats', '/settings']

type SwipeOptions = {
  threshold?: number      // スワイプ確定距離(px)
  maxPull?: number        // 最大追従距離(px) 
  flingMs?: number        // アニメーション時間(ms)
}

export function useHorizontalSwipe({
  threshold = 80,
  maxPull = 140,
  flingMs = 220,
}: SwipeOptions = {}) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // DOM読み込み後に実行
    const timeout = setTimeout(() => {
      const phone = document.getElementById('app-phone')
      if (!phone) {
        console.warn('app-phone element not found')
        return
      }

      // 現在の画面インデックスを取得
      const getCurrentIndex = () => {
        // result画面はhistory扱い
        if (pathname.startsWith('/result')) return 1
        return SCREEN_ORDER.indexOf(pathname)
      }

      // 隣接画面のパスを取得
      const getAdjacentPath = (direction: 'left' | 'right') => {
        const currentIndex = getCurrentIndex()
        if (currentIndex === -1) return null

        if (direction === 'left' && currentIndex > 0) {
          return SCREEN_ORDER[currentIndex - 1]
        }
        if (direction === 'right' && currentIndex < SCREEN_ORDER.length - 1) {
          return SCREEN_ORDER[currentIndex + 1]
        }
        return null
      }

      let startX = 0
      let startY = 0
      let tracking = false
      let pulled = 0
      let direction: 'left' | 'right' | null = null

      const begin = (x: number, y: number) => {
        startX = x
        startY = y
        tracking = true
        pulled = 0
        direction = null
      }

      const move = (x: number, y: number) => {
        if (!tracking) return
        
        const dx = x - startX
        const dy = Math.abs(y - startY)
        const adx = Math.abs(dx)
        
        // 方向未確定の場合のみ判定を行う
        if (!direction) {
          // 縦方向の動きが大きく、明らかに縦スクロール意図の場合は早期キャンセル
          if (dy > 30 && dy > adx * 2.5) {
            cancel()
            return
          }
          // 明確な横スワイプ意図がある場合（横方向が大きく、縦方向が小さい）
          else if (adx > 35 && adx > dy * 1.8) {
            direction = dx > 0 ? 'left' : 'right'
            
            // 隣接画面がない場合はキャンセル
            if (!getAdjacentPath(direction)) {
              cancel()
              return
            }
            
            // 横スワイプ確定後にtouchActionを設定
            phone.style.touchAction = 'none'
          }
          // それ以外の場合はまだ判定しない（縦スクロールを許可）
        }

        // 横スワイプ確定後の処理
        if (direction) {
          pulled = Math.min(adx, maxPull)
          
          // 視覚的フィードバック（スワイプ方向に応じて）
          phone.style.transform = `translateX(${direction === 'left' ? pulled : -pulled}px)`
          phone.style.transition = 'none'
        }
      }

      const end = () => {
        if (!tracking || !direction) {
          cleanup()
          return
        }

        tracking = false
        
        if (pulled >= threshold) {
          // スワイプ確定 - 画面遷移
          const nextPath = getAdjacentPath(direction)
          if (nextPath) {
            phone.style.transition = `transform ${flingMs}ms cubic-bezier(.2,.7,.2,1)`
            phone.style.transform = `translateX(${direction === 'left' ? phone.clientWidth : -phone.clientWidth}px)`
            
            setTimeout(() => {
              router.push(nextPath)
              cleanup()
            }, flingMs)
            return
          }
        }
        
        // スワイプキャンセル - 元に戻す
        phone.style.transition = `transform 160ms ease-out`
        phone.style.transform = 'translateX(0px)'
        setTimeout(cleanup, 160)
      }

      const cancel = () => {
        if (!tracking) return
        tracking = false
        direction = null
        
        phone.style.transition = `transform 120ms ease-out`
        phone.style.transform = 'translateX(0px)'
        setTimeout(cleanup, 120)
      }

      const cleanup = () => {
        phone.style.transition = ''
        phone.style.transform = ''
        phone.style.touchAction = ''
      }

      // イベントリスナー
      const onPointerDown = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') begin(e.clientX, e.clientY)
      }
      const onPointerMove = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') move(e.clientX, e.clientY)
      }
      const onPointerUp = () => end()

      const onTouchStart = (e: TouchEvent) => {
        const t = e.touches[0]
        begin(t.clientX, t.clientY)
      }
      const onTouchMove = (e: TouchEvent) => {
        const t = e.touches[0]
        move(t.clientX, t.clientY)
        // 横方向のスワイプが確定した時のみpreventDefault
        if (tracking && direction) {
          e.preventDefault() // スクロールを防止
        }
      }
      const onTouchEnd = () => end()
      const onTouchCancel = () => cancel()

      phone.addEventListener('pointerdown', onPointerDown)
      phone.addEventListener('pointermove', onPointerMove)
      phone.addEventListener('pointerup', onPointerUp)
      phone.addEventListener('touchstart', onTouchStart, { passive: true })
      phone.addEventListener('touchmove', onTouchMove, { passive: false })
      phone.addEventListener('touchend', onTouchEnd)
      phone.addEventListener('touchcancel', onTouchCancel)

      return () => {
        phone.removeEventListener('pointerdown', onPointerDown)
        phone.removeEventListener('pointermove', onPointerMove)
        phone.removeEventListener('pointerup', onPointerUp)
        phone.removeEventListener('touchstart', onTouchStart)
        phone.removeEventListener('touchmove', onTouchMove)
        phone.removeEventListener('touchend', onTouchEnd)
        phone.removeEventListener('touchcancel', onTouchCancel)
        cleanup()
      }
    }, 100)
    
    return () => clearTimeout(timeout)
  }, [router, pathname, threshold, maxPull, flingMs])
}