import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, ShieldCheck, User, X } from 'lucide-react'
import { api } from '../api/api'
import { useAuth } from '../context/AuthContext'
import { PageHeader, Card, Button, Modal, FormField, Input, Table, Spinner, Badge } from '../components/ui'

const EMPTY = { nome: '', login: '', senha: '', perfil: 'usuario', ativo: true }

const PERFIL_COLOR = { admin: 'purple', usuario: 'blue' }
const PERFIL_LABEL = { admin: 'Admin', usuario: 'Usuário' }

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

  const openNew  = ()  => { setForm(EMPTY); setErro(''); setModal({ mode: 'new' }) }
  const openEdit = (u) => { setForm({ ...u, senha: '' }); setErro(''); setModal({ mode: 'edit', id: u.id }) }
  const close    = ()  => setModal(null)
  const set      = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.nome.trim() || !form.login.trim()) return setErro('Nome e login são obrigatórios.')
    if (modal.mode === 'new' && !form.senha.trim()) return setErro('Senha é obrigatória para novo usuário.')
    setSaving(true); setErro('')
    try {
      if (modal.mode === 'new') await api.auth.criarUsuario(form)
      else                      await api.auth.atualizarUsuario(modal.id, form)
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
            headers={['Usuário', 'Login', 'Perfil', 'Status', '']}
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
                <td className="py-3 px-4">
                  <button
                    onClick={() => toggleAtivo(u)}
                    disabled={u.id === eu.id}
                    className="disabled:cursor-not-allowed"
                  >
                    {u.ativo
                      ? <Badge color="green">Ativo</Badge>
                      : <Badge color="red">Inativo</Badge>
                    }
                  </button>
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                      <Pencil size={14} />
                    </Button>
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
        <Modal
          title={modal.mode === 'new' ? 'Novo Usuário' : 'Editar Usuário'}
          onClose={close}
        >
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
                  { v: 'usuario', icon: User,         label: 'Usuário',       desc: 'Somente visualização' },
                ].map(opt => (
                  <label
                    key={opt.v}
                    className={`flex-1 flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      form.perfil === opt.v ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      className="mt-0.5 accent-blue-600"
                      name="perfil"
                      value={opt.v}
                      checked={form.perfil === opt.v}
                      onChange={() => set('perfil', opt.v)}
                      disabled={modal.mode === 'edit' && modal.id === eu.id}
                    />
                    <div>
                      <p className={`text-sm font-semibold ${form.perfil === opt.v ? 'text-blue-700' : 'text-slate-700'}`}>
                        {opt.label}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
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
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {erro}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={close}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
