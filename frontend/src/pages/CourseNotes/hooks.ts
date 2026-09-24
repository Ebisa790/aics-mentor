// Colocated hooks for CourseNotesPage.
// Extracted verbatim. No behavior changes.

import { useState, useEffect, useCallback } from 'react'

/**
 * Tracks fullscreen state and provides a toggle.
 * Listens for browser-initiated fullscreen changes (Esc key, F11, etc.).
 */
export function useFullscreen(): [boolean, () => void] {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {})
      }
      setIsFullscreen(true)
    } else {
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
      setIsFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  return [isFullscreen, toggleFullscreen]
}
