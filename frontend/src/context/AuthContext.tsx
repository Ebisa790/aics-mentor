import { createContext, useContext, useEffect, useState, useMemo, useCallback, type ReactNode } from 'react'
import { authApi } from '../api'
import { clearTokens, getAccessToken, setTokens } from '../api/client'
import type { User } from '../api/types'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''


interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isPremium: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<any>
  loginWithGoogle: (idToken: string) => Promise<void>
  register: (email: string, password: string, fullName: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<User | null>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async (): Promise<User | null> => {
    if (!getAccessToken()) {
      setUser(null)
      setIsLoading(false)
      return null
    }
    try {
      const userProfile = await authApi.me()
      console.log('refreshUser - fetched fresh user data:', userProfile)
      setUser(userProfile)
      return userProfile
    } catch (error) {
      console.error('refreshUser - failed to fetch user:', error)
      clearTokens()
      setUser(null)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch user profile on initial component mount if token exists
  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  // Add event listener to refresh user when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Refresh user data when tab becomes visible again
        refreshUser()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshUser])

  // Convenience computed flag for UI feature gating
  const isPremium = useMemo(() => {
    if (!user) return false
    // Backend returns lowercase 'premium' or 'free'
    // Our SubscriptionTier type is 'free' | 'premium'
    return user.subscription_tier === 'premium'
  }, [user])

  // Admin check
  const isAdmin = useMemo(() => {
    if (!user) return false
    return user.role === 'admin'
  }, [user])

  const login = async (email: string, password: string) => {
    const authResponse = await authApi.login(email, password)
    console.log('AuthContext login - response:', authResponse)
    
    // Check if 2FA is required
    if (authResponse && (authResponse as any).requires_2fa === true) {
      return authResponse
    }
    
    // Normal login - set tokens
    if (authResponse && authResponse.access_token) {
      setTokens(authResponse.access_token, authResponse.refresh_token)
      await refreshUser()
    }
    
    return authResponse
  }

  const loginWithGoogle = async (idToken: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id_token: idToken }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.detail || 'Google authentication failed')
    }

    const authResponse = await response.json()
    setTokens(authResponse.access_token, authResponse.refresh_token)
    await refreshUser()
  }

  const register = async (email: string, password: string, fullName: string) => {
    await authApi.register({ email, password, full_name: fullName })
    await login(email, password)
  }

  const logout = () => {
    clearTokens()
    setUser(null)
  }

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isPremium,
      isAdmin,
      login,
      loginWithGoogle,
      register,
      logout,
      refreshUser,
    }),
    [user, isLoading, isPremium, isAdmin, refreshUser]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}