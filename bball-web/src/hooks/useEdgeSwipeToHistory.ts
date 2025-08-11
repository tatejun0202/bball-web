'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Opt = {
  edgeStartRatio?: number // 左1/3など
  threshold?: number      // 遷移確定距離(px)
  maxPull?: number        // 最大追従距離(px)
  flingMs?: number        // 放り投げ時間(ms)
}

export function useEdgeSwipeToHistory({
  edgeStartRatio = 1/2,
  threshold = 80,
  maxPull = 140,
  flingMs = 220,
}: Opt = {}) {
  const router = useRouter()

  useEffect(() => {
    const phone = document.getElementById('app-phone')
    const stage = document.getElementById('swipe-stage')
    const hist  = document.getElementById('swipe-history')
    if (!phone || !stage || !hist) return

    // 初期配置: history は左に隣接（-100%）
    const resetPlacement = () => {
      const w = phone.clientWidth
      stage.style.transform = 'translateX(0px)'
      hist.style.transform  = `translateX(${-w}px)`
    }
    resetPlacement()

    let startX = 0, startY = 0, tracking = false, pulled = 0

    const begin = (x:number, y:number) => {
      const w = phone.clientWidth
      if (x > w * edgeStartRatio) return
      startX = x; startY = y; tracking = true; pulled = 0
      stage.style.transition = 'none'
      hist.style.transition  = 'none'
      phone.style.touchAction = 'none'
    }

    const move = (x:number, y:number) => {
      if (!tracking) return
      const dx = Math.max(0, x - startX)
      const dy = Math.abs(y - startY)
      if (dy > 80) { cancel(); return }
      const w = phone.clientWidth
      pulled = Math.min(dx, maxPull)
      // stage は右へ、history は「-w + pulled」で一緒に出てくる
      stage.style.transform = `translateX(${pulled}px)`
      hist.style.transform  = `translateX(${pulled - w}px)`
      stage.style.boxShadow = pulled>0 ? 'rgba(0,0,0,.35) -8px 0 24px' : ''
    }

    const end = () => {
      if (!tracking) return
      tracking = false
      const w = phone.clientWidth
      if (pulled < threshold) {
        // 戻す
        stage.style.transition = 'transform 160ms ease-out'
        hist.style.transition  = 'transform 160ms ease-out'
        stage.style.transform = 'translateX(0px)'
        hist.style.transform  = `translateX(${-w}px)`
        stage.addEventListener('transitionend', cleanupOnce, { once: true })
      } else {
        // 右に放り投げ：両方を画面外/0位置まで
        stage.style.transition = `transform ${flingMs}ms cubic-bezier(.2,.7,.2,1)`
        hist.style.transition  = `transform ${flingMs}ms cubic-bezier(.2,.7,.2,1)`
        stage.style.transform = `translateX(${w}px)`
        hist.style.transform  = 'translateX(0px)'
        stage.addEventListener('transitionend', () => {
          cleanup()
          router.replace('/history') // 完全に流し切ってから遷移
        }, { once: true })
      }
    }

    const cancel = () => {
      if (!tracking) return
      tracking = false
      const w = phone.clientWidth
      stage.style.transition = 'transform 120ms ease-out'
      hist.style.transition  = 'transform 120ms ease-out'
      stage.style.transform = 'translateX(0px)'
      hist.style.transform  = `translateX(${-w}px)`
      stage.addEventListener('transitionend', cleanupOnce, { once: true })
    }

    const cleanup = () => {
      stage.style.transition = ''
      hist.style.transition  = ''
      stage.style.boxShadow  = ''
      phone.style.touchAction = ''
      // ※ 位置は遷移直前/直後で適切に再配置される
    }
    const cleanupOnce = () => cleanup()

    // Pointer優先 + Touchフォールバック
    const onPointerDown = (e:PointerEvent) => { if (e.pointerType!=='mouse') begin(e.clientX, e.clientY) }
    const onPointerMove = (e:PointerEvent) => { if (e.pointerType!=='mouse') move(e.clientX, e.clientY) }
    const onPointerUp   = () => end()

    const onTouchStart = (e:TouchEvent) => { const t=e.touches[0]; begin(t.clientX, t.clientY) }
    const onTouchMove  = (e:TouchEvent) => { const t=e.touches[0]; move(t.clientX, t.clientY) }
    const onTouchEnd   = () => end()
    const onTouchCancel= () => cancel()

    phone.addEventListener('pointerdown', onPointerDown)
    phone.addEventListener('pointermove', onPointerMove)
    phone.addEventListener('pointerup', onPointerUp)
    phone.addEventListener('touchstart', onTouchStart, { passive:true })
    phone.addEventListener('touchmove', onTouchMove, { passive:true })
    phone.addEventListener('touchend', onTouchEnd)
    phone.addEventListener('touchcancel', onTouchCancel)

    // 画面サイズが変わった時も再配置
    const onResize = () => resetPlacement()
    window.addEventListener('resize', onResize)

    return () => {
      phone.removeEventListener('pointerdown', onPointerDown)
      phone.removeEventListener('pointermove', onPointerMove)
      phone.removeEventListener('pointerup', onPointerUp)
      phone.removeEventListener('touchstart', onTouchStart)
      phone.removeEventListener('touchmove', onTouchMove)
      phone.removeEventListener('touchend', onTouchEnd)
      phone.removeEventListener('touchcancel', onTouchCancel)
      window.removeEventListener('resize', onResize)
      cleanup()
    }
  }, [router, edgeStartRatio, threshold, maxPull, flingMs])
}
