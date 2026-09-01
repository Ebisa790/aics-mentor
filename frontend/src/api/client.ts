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

    return Promise.reject(error)
  }
)

export default apiClient