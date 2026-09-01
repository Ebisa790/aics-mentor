// src/utils/deviceParser.ts
import { Device as BackendDevice } from '../api'

export function mapBackendToSessionDevice(
  backendDevice: BackendDevice,
  currentJti?: string
): SessionDevice {
  return {
    id: backendDevice.id,
    deviceType: (backendDevice.device_type as 'desktop' | 'mobile' | 'tablet') || 'desktop',
    os: backendDevice.device_name || 'Unknown OS',
    browser: backendDevice.browser || 'Unknown Browser',
    ipAddress: backendDevice.ip_address || '0.0.0.0',
    lastActive: backendDevice.last_active,
    isCurrent: 
      (Boolean(backendDevice.session_jti) && backendDevice.session_jti === currentJti) ||
      Boolean(backendDevice.is_current_device),
  }
}

export interface SessionDevice {
  id: string
  deviceType: 'desktop' | 'mobile' | 'tablet'
  os: string
  browser: string
  ipAddress: string
  location?: string
  lastActive: string
  isCurrent: boolean
}

export function parseUserAgent(ua: string): { 
  os: string; 
  browser: string; 
  deviceType: 'desktop' | 'mobile' | 'tablet' 
} {
  let os = 'Unknown OS'
  let browser = 'Unknown Browser'
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop'

  // 1. Detect OS
  if (ua.includes('Win')) os = 'Windows'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) os = 'iOS'
  else if (ua.includes('Mac')) os = 'macOS'
  else if (ua.includes('Linux')) os = 'Linux'

  // 2. Detect Device Type
  // Note: Android tablets typically have 'Android' WITHOUT 'Mobile'
  const isMobile = /Mobi/i.test(ua)
  const isAndroid = /Android/i.test(ua)
  const isTablet = /iPad|Tablet/i.test(ua) || (isAndroid && !isMobile)

  if (isTablet) {
    deviceType = 'tablet'
  } else if (isMobile) {
    deviceType = 'mobile'
  }

  // 3. Detect Browser (Order matters: Edge/Opera/Samsung include 'Chrome' & 'Safari')
  if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('SamsungBrowser')) browser = 'Samsung Internet'
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera'
  else if (ua.includes('Edge') || ua.includes('Edg')) browser = 'Microsoft Edge'
  else if (ua.includes('Trident')) browser = 'Internet Explorer'
  else if (ua.includes('Chrome')) browser = 'Chrome'
  else if (ua.includes('Safari')) browser = 'Safari'

  return { os, browser, deviceType }
}

/**
 * Converts ISO timestamp strings into human-readable relative time (e.g., "Just now", "5m ago").
 */
export function formatRelativeTime(dateString: string): string {
  if (!dateString) return 'Unknown'

  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString

  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 30) return 'Just now'
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}