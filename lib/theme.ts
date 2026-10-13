'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Light/dark switching for the rebuilt admin screens.
 *
 * The class lives on <html> and is set before first paint by the boot script in
 * `app/layout.tsx`, so a reload never flashes the light theme. Only screens
 * built on the design tokens follow it; the older role screens are still on
 * hardcoded Tailwind palettes and stay light on purpose.
 */
export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'dfi-theme'

/** Inlined in <head> so the class is on <html> before the first paint. */
export const THEME_BOOT_SCRIPT = `(function(){try{if(localStorage.getItem('${THEME_STORAGE_KEY}')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})()`

function readTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function useTheme() {
  // Starts light on the server and on first client render so markup matches;
  // the effect below corrects it from the class the boot script already set.
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    setTheme(readTheme())
  }, [])

  const apply = useCallback((next: Theme) => {
    document.documentElement.classList.toggle('dark', next === 'dark')
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Private browsing or a blocked store — the theme just won't persist.
    }
    setTheme(next)
  }, [])

  const toggleTheme = useCallback(() => {
    apply(readTheme() === 'dark' ? 'light' : 'dark')
  }, [apply])

  return { theme, setTheme: apply, toggleTheme }
}
