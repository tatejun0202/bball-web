'use client'
import Link from 'next/link'
import { useState } from 'react'

export default function HeaderWithMenu() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <header style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 14px', background:'#1c1c1c'
      }}>
        <Link href="/settings" aria-label="settings"
          style={{ fontSize:20, lineHeight:1, textDecoration:'none', color:'#ddd' }}>⚙</Link>
        <button aria-label="menu" onClick={()=>setOpen(true)}
          style={{ fontSize:22, lineHeight:1, color:'#ddd', background:'none', border:'none', cursor:'pointer' }}>
          ≡
        </button>
      </header>

      {open && (
        <div
          role="dialog" aria-modal="true"
          style={{ position:'fixed', inset:0, zIndex:50 }}
          onClick={()=>setOpen(false)}
        >
          {/* 透過オーバーレイ */}
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.35)' }} />

          {/* 右ドロワー */}
          <nav
            onClick={(e)=>e.stopPropagation()}
            style={{
              position:'absolute', top:0, right:0, height:'100dvh',
              width:260, background:'#222', color:'#cfcfcf', padding:'20px 16px',
              boxShadow:'-12px 0 24px rgba(0,0,0,.25)'
            }}
          >
            <ul style={{ display:'grid', gap:22, marginTop:8, fontWeight:700, fontSize:24 }}>
              <li><Link href="/session" onClick={()=>setOpen(false)} style={{ color:'inherit', textDecoration:'none' }}>Session</Link></li>
              <li><Link href="/history" onClick={()=>setOpen(false)} style={{ color:'inherit', textDecoration:'none' }}>History</Link></li>
              <li><Link href="/stats" onClick={()=>setOpen(false)} style={{ color:'inherit', textDecoration:'none' }}>Stats</Link></li>
              <li><Link href="/settings" onClick={()=>setOpen(false)} style={{ color:'inherit', textDecoration:'none' }}>Setting</Link></li>
            </ul>
            <button
              aria-label="close"
              onClick={()=>setOpen(false)}
              style={{
                position:'absolute', right:18, bottom:18, width:48, height:48,
                borderRadius:'50%', background:'none', border:'2px solid #7a7a7a',
                color:'#cfcfcf', fontSize:22, cursor:'pointer'
              }}
            >×</button>
          </nav>
        </div>
      )}
    </>
  )
}
