// src/components/FooterNavigation.tsx
'use client'
import { useRouter, usePathname } from 'next/navigation'

export default function FooterNavigation() {
  const router = useRouter()
  const pathname = usePathname()

  // 現在のページから選択中のタブを判定
  const getActiveTab = () => {
    if (pathname === '/session') return 'session'
    if (pathname === '/history') return 'history'
    if (pathname.startsWith('/result')) return 'history' // result画面はhistory扱い
    if (pathname === '/stats') return 'stats'
    if (pathname === '/settings') return 'settings'
    return 'history' // デフォルト
  }

  const activeTab = getActiveTab()

  const navItems = [
    {
      key: 'session',
      icon: '🏀',
      label: 'Session',
      path: '/session'
    },
    {
      key: 'history',
      icon: '📋',
      label: 'History',
      path: '/history'
    },
    {
      key: 'stats',
      icon: '📊',
      label: 'Stats',
      path: '/stats'
    },
    {
      key: 'settings',
      icon: '⚙️',
      label: 'Settings',
      path: '/settings'
    }
  ]

  const handleNavClick = (path: string) => {
    router.push(path)
  }

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: 60,
      background: '#1c1c1c',
      borderTop: '1px solid #2a2a2a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      padding: '0 8px',
      zIndex: 50
    }}>
      {navItems.map((item) => {
        const isActive = activeTab === item.key
        
        return (
          <button
            key={item.key}
            onClick={() => handleNavClick(item.path)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              padding: '6px 12px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              borderRadius: 8,
              transition: 'all 0.2s ease',
              color: isActive ? '#0ea5e9' : '#9aa',
              WebkitTapHighlightColor: 'transparent',
              WebkitAppearance: 'none',
              touchAction: 'manipulation'
            }}
          >
            <span style={{ 
              fontSize: 20,
              filter: isActive ? 'none' : 'grayscale(0.5)',
              transition: 'filter 0.2s ease'
            }}>
              {item.icon}
            </span>
            <span style={{ 
              fontSize: 10, 
              fontWeight: isActive ? 600 : 400,
              transition: 'font-weight 0.2s ease'
            }}>
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}