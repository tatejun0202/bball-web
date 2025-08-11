'use client'

export default function SwipeStage({ children }: { children: React.ReactNode }) {
  // シンプルにchildrenをそのまま表示
  return (
    <div style={{ 
      position: 'absolute', 
      inset: 0, 
      background: '#1c1c1c' 
    }}>
      {children}
    </div>
  )
}