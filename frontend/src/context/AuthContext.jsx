import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Ao carregar, verifica se já existe sessão salva
    const token = localStorage.getItem('orcapro_token')
    const user  = localStorage.getItem('orcapro_usuario')
    if (token && user) {
      try { setUsuario(JSON.parse(user)) }
      catch { localStorage.clear() }
    }
    setLoading(false)
  }, [])

  const login = (token, user) => {
    localStorage.setItem('orcapro_token', token)
    localStorage.setItem('orcapro_usuario', JSON.stringify(user))
    setUsuario(user)
  }

  const logout = () => {
    localStorage.removeItem('orcapro_token')
    localStorage.removeItem('orcapro_usuario')
    setUsuario(null)
  }

  return (
    <AuthContext.Provider value={{
      usuario,
      loading,
      login,
      logout,
      isAdmin: usuario?.perfil === 'admin'
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
