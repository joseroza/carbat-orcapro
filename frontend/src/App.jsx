import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { FileText, Users, Truck, BarChart3 } from 'lucide-react'
import ClientesPage from './pages/ClientesPage'
import PropostasPage from './pages/PropostasPage'
import RomaneiosPage from './pages/RomaneiosPage'
import DashboardPage from './pages/DashboardPage'

function Layout({ children }) {
  const nav = [
    { to: '/',          icon: BarChart3,  label: 'Dashboard'  },
    { to: '/clientes',  icon: Users,      label: 'Clientes'   },
    { to: '/propostas', icon: FileText,   label: 'Propostas'  },
    { to: '/romaneios', icon: Truck,      label: 'Romaneios'  },
  ]

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
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <p className="text-xs text-slate-500">v1.0.0</p>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/"          element={<DashboardPage />} />
          <Route path="/clientes"  element={<ClientesPage />}  />
          <Route path="/propostas" element={<PropostasPage />} />
          <Route path="/romaneios" element={<RomaneiosPage />} />
          <Route path="*"          element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
