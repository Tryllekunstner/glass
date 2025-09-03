'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import SearchPopup from '@/components/SearchPopup'
import { useAuth } from '@/utils/auth'

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { showSidebar, isLoading } = useAuth()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex h-screen">
      {showSidebar && (
        <Sidebar 
          isCollapsed={isSidebarCollapsed} 
          onToggle={setIsSidebarCollapsed}
          onSearchClick={() => setIsSearchOpen(true)}
        />
      )}
      <main className={`flex-1 overflow-auto bg-white ${!showSidebar ? 'w-full' : ''}`}>
        {children}
      </main>
      
      {showSidebar && (
        <SearchPopup 
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
        />
      )}
    </div>
  )
}
