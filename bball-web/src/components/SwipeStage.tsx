'use client'
import { usePathname } from 'next/navigation'
import HeaderWithMenu from '@/components/HeaderWithMenu'
import HistoryScreen from '@/components/HistoryScreen'

export default function SwipeStage({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // /history ではスワイプ用の左右構成は不要（通常表示）
  if (pathname === '/history') {
    return (
      <div id="swipe-stage" style={{ position:'absolute', inset:0, background:'#1c1c1c' }}>
        <HeaderWithMenu />
        <div style={{ borderBottom:'1px solid #2a2a2a' }} />
        {children}
      </div>
    )
  }

  // それ以外の画面では、左に本物の History、右に現在の画面（stage）
  return (
    <div id="swipe-container" style={{ position:'absolute', inset:0 }}>
      {/* 左：本物のHistory（初期は画面の左に隠す） */}
      <div id="swipe-history"
           style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', background:'#1c1c1c',
                    transform:'translateX(-100%)', overflow:'hidden' }}>
        {/* ★修正: ヘッダーも含む */}
        <HeaderWithMenu />
        <div style={{ borderBottom:'1px solid #2a2a2a' }} />
        <HistoryScreen/>
      </div>

      {/* 右：現在の画面（ヘッダーごと）。これを右へ動かす */}
      <div id="swipe-stage"
           style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', background:'#1c1c1c' }}>
        <HeaderWithMenu />
        <div style={{ borderBottom:'1px solid #2a2a2a' }} />
        {children}
      </div>
    </div>
  )
}