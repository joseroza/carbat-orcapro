import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, Eye, EyeOff } from 'lucide-react'
import { api } from '../api/api'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const [form, setForm]       = useState({ login: '', senha: '' })
  const [erro, setErro]       = useState('')
  const [loading, setLoading] = useState(false)
  const [verSenha, setVerSenha] = useState(false)
  const { login } = useAuth()
  const navigate  = useNavigate()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.login.trim() || !form.senha.trim()) {
      return setErro('Preencha o login e a senha.')
    }
    setErro('')
    setLoading(true)
    try {
      const res = await api.auth.login(form)
      login(res.token, res.usuario)
      navigate('/')
    } catch (e) {
      setErro(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo / cabeçalho */}
        <div className="text-center mb-8">
          <img
            src="https://carbat.com.br/wp-content/uploads/2024/06/Carbat-logo-sem-fundo--e1746032537163.png"
            alt="Carbat"
            className="h-12 object-contain mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-white">OrcaPro</h1>
          <p className="text-slate-400 text-sm mt-1">Faça login para continuar</p>
        </div>

        {/* Card de login */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Login
              </label>
              <input
                type="text"
                autoComplete="username"
                autoFocus
                value={form.login}
                onChange={e => set('login', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
                placeholder="seu login"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Senha
              </label>
              <div className="relative">
                <input
                  type={verSenha ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.senha}
                  onChange={e => set('senha', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setVerSenha(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {verSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 font-medium">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn size={16} />
              )}
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

          </form>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          Carbat do Brasil © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
