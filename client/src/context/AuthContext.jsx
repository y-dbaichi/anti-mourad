import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const token = localStorage.getItem('token')
    if (token) {
      try {
        const response = await api.get('/auth/me')
        setUser(response.data.user)
        setSubscription(response.data.subscription)
      } catch (error) {
        localStorage.removeItem('token')
      }
    }
    setLoading(false)
  }

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password })
    localStorage.setItem('token', response.data.token)
    setUser(response.data.user)
    await checkAuth() // Refresh to get subscription
    return response.data
  }

  const register = async (email, password, fullName) => {
    const response = await api.post('/auth/register', { email, password, fullName })
    localStorage.setItem('token', response.data.token)
    setUser(response.data.user)
    await checkAuth()
    return response.data
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
    setSubscription(null)
  }

  const refreshSubscription = async () => {
    try {
      const response = await api.get('/auth/me')
      setSubscription(response.data.subscription)
    } catch (error) {
      console.error('Failed to refresh subscription')
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      subscription,
      loading,
      login,
      register,
      logout,
      refreshSubscription,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  )
}
