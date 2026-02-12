'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

interface FontSizeContextValue {
  level: number // -3 to +3 (0 = default)
  increase: () => void
  decrease: () => void
  reset: () => void
}

const FontSizeContext = createContext<FontSizeContextValue>({
  level: 0,
  increase: () => {},
  decrease: () => {},
  reset: () => {},
})

export function useFontSize() {
  return useContext(FontSizeContext)
}

const MIN_LEVEL = -3
const MAX_LEVEL = 5
const STEP = 0.1 // 10% per step — level 3 = 130%, level 5 = 150%
const STORAGE_KEY = 'font-size-level'

function applyFontSize(level: number) {
  const scale = 1 + level * STEP
  document.documentElement.style.fontSize = `${scale * 100}%`
}

export function FontSizeProvider({ children }: { children: React.ReactNode }) {
  const [level, setLevel] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = parseInt(stored, 10)
      if (!isNaN(parsed) && parsed >= MIN_LEVEL && parsed <= MAX_LEVEL) {
        setLevel(parsed)
        applyFontSize(parsed)
      }
    }
    setMounted(true)
  }, [])

  const updateLevel = useCallback((newLevel: number) => {
    const clamped = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, newLevel))
    setLevel(clamped)
    applyFontSize(clamped)
    localStorage.setItem(STORAGE_KEY, String(clamped))
  }, [])

  const increase = useCallback(() => updateLevel(level + 1), [level, updateLevel])
  const decrease = useCallback(() => updateLevel(level - 1), [level, updateLevel])
  const reset = useCallback(() => updateLevel(0), [updateLevel])

  // Listen for Cmd+=/Cmd+- keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        increase()
      } else if (e.key === '-') {
        e.preventDefault()
        decrease()
      } else if (e.key === '0') {
        e.preventDefault()
        reset()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [increase, decrease, reset])

  if (!mounted) {
    return <>{children}</>
  }

  return (
    <FontSizeContext.Provider value={{ level, increase, decrease, reset }}>
      {children}
    </FontSizeContext.Provider>
  )
}
