import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, ShieldCheck, User, X, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '../api/api'
import { useAuth } from '../context/AuthContext'
import { PageHeader, Card, Button, Modal, FormField, Input, Table, Spinner, Badge } from '../components/ui'

const EMPTY_PERMISSOES = {
  propostas_ver: true,
  propostas_criar: false,
  propostas_editar: false,
  propostas_excluir: false,
  propostas_exportar: true,
  propostas_revisao: false,
  clientes_ver: true,
  clientes_criar: false,
  clientes_editar: false,
  clientes_excluir: false,
  romaneios_ver: true,
  romaneios_criar: false,
  romaneios_editar: false,
  romaneios_excluir: false,
}

const GRUPOS_PERMISSOES = [
  {
    label: 'Propostas',
    cor: 'blue',
    itens: [
      { key: 'propostas_ver',      label: 'Visualizar' },
      { key: 'propostas_criar',    label: 'Criar' },
      { key: 'propostas_editar',   label: 'Editar' },
      { key: 'propostas_excluir',  label: 'Excluir' },
      { key: 'propostas_exportar', label: 'Exportar PDF/Word' },
      { key: 'propostas_revisao',  label: 'Gerar Revisão' },
    ]
  },
  {
    label: 'Clientes',
    cor: 'green',
    itens: [
      { key: 'clientes_ver',     label: 'Visualizar' },
      { key: 'clientes_criar',   label: 'Criar' },
      { key: 'clientes_editar',  label: 'Editar' },
      { key: 'clientes_excluir', label: 'Excluir' },
    ]
  },
  {
    label: 'Romaneios',
    cor: 'orange',
    itens: [
      { key: 'romaneios_ver',     label: 'Visualizar' },
      { key: 'romaneios_criar',   label: 'Criar' },
      { key: 'romaneios_editar',  label: 'Editar' },
      { key: 'romaneios_excluir', label: 'Excluir' },
    ]
  },
]

const COR = {
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   title: 'text-blue-700',   check: 'accent-blue-600'   },
  green:  { bg: 'bg-green-50',  border: 'border-green-200',  title: 'text-green-700',  check: 'accent-green-600'  },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', title: 'text-orange-700', check: 'accent-orange-600' },
}

const EMPTY = { nome: '', login: '', senha: '', perfil: 'usuario', ativo: true, permissoes: { ...EMPTY_PERMISSOES } }
const PERFIL_COLOR = { admin: 'purple', usuario: 'blue' }
const PERFIL_LABEL = { admin: 'Admin', usuario: 'Usuário' }

function PermissoesEditor({ permissoes, onChange, disabled }) {
  const [abertos, setAbertos] = useState({ Propostas: true, Clientes: false, Romaneios: false })

  const toggle = (key) => onChange({ ...permissoes, [key]: !permissoes[key] })
  const toggleGrupo = (label) => setAbertos(a => ({ ...a, [label]: !a[label] }))
  const marcarTodos = (itens, valor) => {
    const update = {}
    itens.forEach(i => update[i.key] = valor)
    onChange({ ...permissoes, ...update })
  }

  if (disabled) {
    return (
      <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-sm text-purple-700 font-medium">
        ✓ Administrador possui acesso total ao sistema automaticamente.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {GRUPOS_PERMISSOES.map(grupo => {
        const c = COR[grupo.cor]
        const aberto = abertos[grupo.label]
        const todos = grupo.itens.every(i => permissoes[i.key])
        const nenhum = grupo.itens.every(i => !permissoes[i.key])
        return (
          <div key={grupo.label} className={`border ${c.border} rounded-xl overflow-hidden`}>
            <div className={`flex items-center justify-between px-4 py-2.5 ${c.bg} cursor-pointer`}
              onClick={() => toggleGrupo(grupo.label)}>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold ${c.title}`}>{grupo.label}</span>
                <span className="text-xs text-slate-400">
                  {grupo.itens.filter(i => permissoes[i.key]).length}/{grupo.itens.length} permissões
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button"
                  onClick={e => { e.stopPropagation(); marcarTodos(grupo.itens, !todos) }}
                  className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                    todos ? 'bg-slate-200 text-slate-600 border-slate-300' : `${c.bg} ${c.title} border-current`
                  }`}>
                  {todos ? 'Desmarcar todos' : 'Marcar todos'}
                </button>
                {aberto ? <ChevronUp size={14} className="text-slate-400"/> : <ChevronDown size={14} className="text-slate-400"/>}
              </div>
            </div>
            {aberto && (
              <div className="px-4 py-3 bg-white grid grid-cols-2 gap-2">
                {grupo.itens.map(item => (
                  <label key={item.key} className="flex items-center gap-2.5 cursor-pointer group">
                    <div onClick={() => toggle(item.key)}
                      className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 relative cursor-pointer ${
                        permissoes[item.key] ? 'bg-green-500' : 'bg-slate-200'
                      }`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        permissoes[item.key] ? 'translate-x-5' : 'translate-x-0.5'
                      }`}/>
                    </div>
                    <span className={`text-sm ${permissoes[item.key] ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function UsuariosPage() {
  const { usuario: eu } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(null)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState(EMPTY)
  const [erro, setErro]         = useState('')

  const load = () =>
    api.auth.listarUsuarios().then(setUsuarios).finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const openNew  = () => { setForm(EMPTY); setErro(''); setModal({ mode: 'new' }) }
  const openEdit = (u) => {
    setForm({
      ...u,
      senha: '',
      permissoes: { ...EMPTY_PERMISSOES, ...(u.permissoes || {}) }
    })
    setErro('')
    setModal({ mode: 'edit', id: u.id })
  }
  const close = () => setModal(null)
  const set   = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setPerms = (perms) => setForm(f => ({ ...f, permissoes: perms }))

  const save = async () => {
    if (!form.nome.trim() || !form.login.trim()) return setErro('Nome e login são obrigatórios.')
    if (modal.mode === 'new' && !form.senha.trim()) return setErro('Senha é obrigatória para novo usuário.')
    setSaving(true); setErro('')
    try {
      const payload = { ...form }
      if (modal.mode === 'new') await api.auth.criarUsuario(payload)
      else                      await api.auth.atualizarUsuario(modal.id, payload)
      await load(); close()
    } catch (e) { setErro(e.message) }
    finally { setSaving(false) }
  }

  const del = async (u) => {
    if (u.id === eu.id) return alert('Você não pode excluir sua própria conta.')
    if (!confirm(`Excluir o usuário "${u.nome}"?`)) return
    try { await api.auth.excluirUsuario(u.id); load() }
    catch (e) { alert(e.message) }
  }

  const toggleAtivo = async (u) => {
    if (u.id === eu.id) return alert('Você não pode desativar sua própria conta.')
    try {
      await api.auth.atualizarUsuario(u.id, { ...u, ativo: !u.ativo })
      setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, ativo: !u.ativo } : x))
    } catch (e) { alert(e.message) }
  }

  // Contar permissões ativas de um usuário
  const contarPermissoes = (u) => {
    if (u.perfil === 'admin') return 'Acesso total'
    const perms = u.permissoes || {}
    const total = Object.keys(EMPTY_PERMISSOES).length
    const ativas = Object.keys(EMPTY_PERMISSOES).filter(k => perms[k]).length
    return `${ativas}/${total} permissões`
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Usuários"
        subtitle={`${usuarios.length} usuário${usuarios.length !== 1 ? 's' : ''} cadastrado${usuarios.length !== 1 ? 's' : ''}`}
        action={<Button onClick={openNew}><Plus size={16} /> Novo Usuário</Button>}
      />

      <Card>
        {loading ? <Spinner /> : (
          <Table
            headers={['Usuário', 'Login', 'Perfil', 'Permissões', 'Status', '']}
            empty={usuarios.length === 0 ? 'Nenhum usuário cadastrado' : ''}
          >
            {usuarios.map(u => (
              <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${u.perfil === 'admin' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                      {u.perfil === 'admin'
                        ? <ShieldCheck size={14} className="text-purple-600" />
                        : <User size={14} className="text-blue-600" />
                      }
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{u.nome}</p>
                      {u.id === eu.id && <p className="text-xs text-slate-400">você</p>}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 font-mono text-sm text-slate-600">{u.login}</td>
                <td className="py-3 px-4">
                  <Badge color={PERFIL_COLOR[u.perfil] || 'gray'}>
                    {PERFIL_LABEL[u.perfil] || u.perfil}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-xs text-slate-500">{contarPermissoes(u)}</td>
                <td className="py-3 px-4">
                  <button onClick={() => toggleAtivo(u)} disabled={u.id === eu.id} className="disabled:cursor-not-allowed">
                    {u.ativo ? <Badge color="green">Ativo</Badge> : <Badge color="red">Inativo</Badge>}
                  </button>
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(u)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="sm" onClick={() => del(u)} disabled={u.id === eu.id}>
                      <Trash2 size={14} className={u.id === eu.id ? 'text-slate-300' : 'text-red-500'} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {modal && (
        <Modal title={modal.mode === 'new' ? 'Novo Usuário' : 'Editar Usuário'} onClose={close}>
          <div className="space-y-4">
            <FormField label="Nome completo" required>
              <Input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: João Silva" />
            </FormField>

            <FormField label="Login" required>
              <Input
                value={form.login}
                onChange={e => set('login', e.target.value.toLowerCase())}
                placeholder="Ex: joao"
                disabled={modal.mode === 'edit' && modal.id === eu.id}
              />
            </FormField>

            <FormField label={modal.mode === 'new' ? 'Senha' : 'Nova senha (deixe em branco para manter)'}>
              <Input
                type="password"
                value={form.senha}
                onChange={e => set('senha', e.target.value)}
                placeholder={modal.mode === 'new' ? 'Mínimo 6 caracteres' : 'Deixe em branco para não alterar'}
              />
            </FormField>

            <FormField label="Perfil">
              <div className="flex gap-3">
                {[
                  { v: 'admin',   icon: ShieldCheck, label: 'Administrador', desc: 'Acesso total ao sistema' },
                  { v: 'usuario', icon: User,         label: 'Usuário',       desc: 'Permissões configuráveis' },
                ].map(opt => (
                  <label key={opt.v} className={`flex-1 flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    form.perfil === opt.v ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}>
                    <input type="radio" className="mt-0.5 accent-blue-600" name="perfil" value={opt.v}
                      checked={form.perfil === opt.v}
                      onChange={() => set('perfil', opt.v)}
                      disabled={modal.mode === 'edit' && modal.id === eu.id}
                    />
                    <div>
                      <p className={`text-sm font-semibold ${form.perfil === opt.v ? 'text-blue-700' : 'text-slate-700'}`}>{opt.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </FormField>

            <FormField label="Permissões de Acesso">
              <PermissoesEditor
                permissoes={form.permissoes || EMPTY_PERMISSOES}
                onChange={setPerms}
                disabled={form.perfil === 'admin'}
              />
            </FormField>

            {modal.mode === 'edit' && (
              <FormField label="Status">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => modal.id !== eu.id && set('ativo', !form.ativo)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      form.ativo ? 'bg-green-500' : 'bg-slate-300'
                    } ${modal.id === eu.id ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      form.ativo ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </div>
                  <span className="text-sm text-slate-700">{form.ativo ? 'Ativo' : 'Inativo'}</span>
                </label>
              </FormField>
            )}

            {erro && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{erro}</div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={close}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
