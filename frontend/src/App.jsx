import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { FileText, Users, Truck, BarChart3, ShieldCheck, LogOut } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import ClientesPage   from './pages/ClientesPage'
import PropostasPage  from './pages/PropostasPage'
import RomaneiosPage  from './pages/RomaneiosPage'
import DashboardPage  from './pages/DashboardPage'
import LoginPage      from './pages/LoginPage'
import UsuariosPage   from './pages/UsuariosPage'
import { Spinner }    from './components/ui'

// ─── Layout com sidebar ───────────────────────────────────────────────────────
function Layout({ children }) {
  const { usuario, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  const nav = [
    { to: '/',          icon: BarChart3, label: 'Dashboard'  },
    { to: '/clientes',  icon: Users,     label: 'Clientes'   },
    { to: '/propostas', icon: FileText,  label: 'Propostas'  },
    { to: '/romaneios', icon: Truck,     label: 'Romaneios'  },
    // Menu de Usuários só aparece para admin
    ...(isAdmin ? [{ to: '/usuarios', icon: ShieldCheck, label: 'Usuários' }] : []),
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-slate-900 text-white flex flex-col">
        <div className="p-5 border-b border-slate-700">
          <h1 className="text-lg font-bold text-blue-400">Carbat</h1>
          <p className="text-xs text-slate-400">OrcaPro</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Rodapé com usuário logado e botão de logout */}
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
              isAdmin ? 'bg-purple-600' : 'bg-blue-600'
            }`}>
              <span className="text-xs font-bold text-white">
                {usuario?.nome?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{usuario?.nome}</p>
              <p className="text-xs text-slate-400">{isAdmin ? 'Administrador' : 'Usuário'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <LogOut size={13} />
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}

// ─── Rota protegida — redireciona para login se não autenticado ───────────────
function ProtectedRoute({ children, adminOnly = false }) {
  const { usuario, loading, isAdmin } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Spinner />
    </div>
  )

  if (!usuario) return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />

  return children
}

// ─── App principal ────────────────────────────────────────────────────────────
function AppRoutes() {
  const { usuario, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Spinner />
    </div>
  )

  return (
    <Routes>
      {/* Rota pública */}
      <Route path="/login" element={
        usuario ? <Navigate to="/" replace /> : <LoginPage />
      } />

      {/* Rotas protegidas */}
      <Route path="/" element={
        <ProtectedRoute><Layout><DashboardPage /></Layout></ProtectedRoute>
      } />
      <Route path="/clientes" element={
        <ProtectedRoute><Layout><ClientesPage /></Layout></ProtectedRoute>
      } />
      <Route path="/propostas" element={
        <ProtectedRoute><Layout><PropostasPage /></Layout></ProtectedRoute>
      } />
      <Route path="/romaneios" element={
        <ProtectedRoute><Layout><RomaneiosPage /></Layout></ProtectedRoute>
      } />

      {/* Rota exclusiva de admin */}
      <Route path="/usuarios" element={
        <ProtectedRoute adminOnly><Layout><UsuariosPage /></Layout></ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
