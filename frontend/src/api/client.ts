import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

// Fallback to empty string for Vite dev proxy handling (/api/...)
const API_BASE_URL = import.meta.env.VITE_API_URL ?? ''

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// --- State & Token Helpers ---
let accessToken: string | null = localStorage.getItem('access_token')
let refreshToken: string | null = localStorage.getItem('refresh_token')

export function setTokens(access: string, refresh?: string) {
  accessToken = access
  localStorage.setItem('access_token', access)

  if (refresh) {
    refreshToken = refresh
    localStorage.setItem('refresh_token', refresh)
  }
}

export function clearTokens() {
  accessToken = null
  refreshToken = null
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

export function getAccessToken() {
  return accessToken
}

export function getRefreshToken() {
  return refreshToken
}

// --- Request Interceptor ---
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  // Allow browser to automatically calculate boundary for multipart/form-data
  if (config.data instanceof FormData) {
    if (typeof config.headers.delete === 'function') {
      config.headers.delete('Content-Type')
    } else {
      delete config.headers['Content-Type']
    }
  }

  return config
})

// --- Queue Mechanism for Concurrent 401s ---
let isRefreshing = false

type QueueItem = {
  resolve: (token: string) => void
  reject: (error: unknown) => void
}

let pendingQueue: QueueItem[] = []

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  pendingQueue.forEach((promise) => {
    if (error) {
      promise.reject(error)
    } else if (token) {
      promise.resolve(token)
    }
  })
  pendingQueue = []
}

// --- Friendly Error Message Extractor ---
function getFriendlyErrorMessage(error: AxiosError): string {
  const data = error.response?.data as any

  // Backend usually returns { detail: '...' }
  if (data?.detail) {
    // If detail is an object (FastAPI validation), extract first error
    if (typeof data.detail === 'string') return data.detail
    if (Array.isArray(data.detail) && data.detail.length > 0) {
      const first = data.detail[0]
      if (first?.msg) return first.msg
    }
  }

  if (data?.message) {
    if (typeof data.message === 'string') return data.message
    if (typeof data.message === 'object' && data.message?.message) {
      return data.message.message
    }
  }

  if (data?.error) {
    if (typeof data.error === 'string') return data.error
    if (typeof data.error === 'object' && data.error?.message) {
      return data.error.message
    }
  }

  // Fallbacks by status code
  const status = error.response?.status
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 403) return 'You do not have permission to perform this action.'
  if (status === 404) return 'The requested resource was not found.'
  if (status === 429) return 'Too many requests. Please slow down and try again.'
  if (status === 500) return 'Something went wrong on our end. Please try again.'
  if (status === 502 || status === 503) return 'The service is temporarily unavailable. Please try again later.'

  return 'Something went wrong. Please try again.'
}

// Attach the friendly message to the error before rejecting
function normalizeApiError(error: AxiosError): AxiosError {
  ;(error as any).friendlyMessage = getFriendlyErrorMessage(error)
  return error
}

// --- Response Interceptor with Silent Token Refresh ---
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // Bypass refresh logic for login/refresh requests to prevent infinite loops
    const isAuthRoute =
      originalRequest?.url?.includes('/api/auth/login') ||
      originalRequest?.url?.includes('/api/auth/refresh')

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthRoute &&
      refreshToken
    ) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          pendingQueue.push({ resolve, reject })
        })
          .then((newToken) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`
            return apiClient(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const { data } = await axios.post(
          `${API_BASE_URL}/api/auth/refresh`,
          null,
          {
            params: { refresh_token: refreshToken },
          }
        )

        const newAccessToken = data.access_token
        const newRefreshToken = data.refresh_token ?? refreshToken

        setTokens(newAccessToken, newRefreshToken)
        processQueue(null, newAccessToken)

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null)
        clearTokens()

        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(normalizeApiError(error))
  }
)

export default apiClient