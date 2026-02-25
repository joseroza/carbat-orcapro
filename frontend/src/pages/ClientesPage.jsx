import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Search, CheckCircle, XCircle } from 'lucide-react'
import { api } from '../api/api'
import {
  PageHeader, Card, Button, Modal, FormField, Input, Table, Spinner
} from '../components/ui'

const EMPTY = {
  razao_social: '', nome_fantasia: '', cnpj: '', email: '',
  telefone: '', endereco: '', cidade: '', estado: '', contato_principal: '',
  aprovado: null
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [modal, setModal]       = useState(null)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState(EMPTY)

  const load = () => api.clientes.list().then(setClientes).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const openNew  = ()  => { setForm(EMPTY); setModal({ mode: 'new' }) }
  const openEdit = (c) => { setForm(c);     setModal({ mode: 'edit', id: c.id }) }
  const close    = ()  => setModal(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.razao_social.trim()) return alert('Razão Social é obrigatória')
    setSaving(true)
    try {
      if (modal.mode === 'new') await api.clientes.create(form)
      else                      await api.clientes.update(modal.id, form)
      await load(); close()
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  const del = async (id) => {
    if (!confirm('Excluir este cliente?')) return
    await api.clientes.delete(id); load()
  }

  // Alterna aprovado → reprovado → aprovado (null vira aprovado na primeira vez)
  const toggleAprovado = async (cliente) => {
    const novoStatus = cliente.aprovado === true ? false : true
    try {
      await api.clientes.update(cliente.id, { ...cliente, aprovado: novoStatus })
      setClientes(prev =>
        prev.map(c => c.id === cliente.id ? { ...c, aprovado: novoStatus } : c)
      )
    } catch (e) { alert(e.message) }
  }

  const filtered = clientes.filter(c =>
    (c.razao_social + c.nome_fantasia + c.cnpj + c.cidade).toLowerCase()
      .includes(search.toLowerCase())
  )

  return (
    <div className="p-8">
      <PageHeader
        title="Clientes"
        subtitle={`${clientes.length} cadastrados`}
        action={<Button onClick={openNew}><Plus size={16} /> Novo Cliente</Button>}
      />

      <Card>
        <div className="p-4 border-b flex items-center gap-3">
          <Search size={16} className="text-slate-400" />
          <input
            className="flex-1 text-sm outline-none"
            placeholder="Buscar clientes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? <Spinner /> : (
          <Table
            headers={['Razão Social', 'Nome Fantasia', 'CNPJ', 'Cidade/UF', 'Contato', 'Status', '']}
            empty={filtered.length === 0 ? 'Nenhum cliente encontrado' : ''}
          >
            {filtered.map(c => (
              <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4 font-medium text-slate-800">{c.razao_social}</td>
                <td className="py-3 px-4 text-slate-600">{c.nome_fantasia || '—'}</td>
                <td className="py-3 px-4 text-slate-600 font-mono text-xs">{c.cnpj || '—'}</td>
                <td className="py-3 px-4 text-slate-600">{c.cidade ? `${c.cidade}/${c.estado}` : '—'}</td>
                <td className="py-3 px-4 text-slate-600">{c.contato_principal || '—'}</td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => toggleAprovado(c)}
                    title={c.aprovado === true ? 'Clique para reprovar' : c.aprovado === false ? 'Clique para aprovar' : 'Clique para definir status'}
                    className="flex items-center gap-1.5 transition-opacity hover:opacity-75"
                  >
                    {c.aprovado === true && (
                      <>
                        <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                        <span className="text-xs font-semibold text-green-600">Aprovado</span>
                      </>
                    )}
                    {c.aprovado === false && (
                      <>
                        <XCircle size={16} className="text-red-500 flex-shrink-0" />
                        <span className="text-xs font-semibold text-red-600">Reprovado</span>
                      </>
                    )}
                    {(c.aprovado === null || c.aprovado === undefined) && (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
                        <span className="text-xs text-slate-400">Pendente</span>
                      </>
                    )}
                  </button>
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="sm" onClick={() => del(c.id)}><Trash2 size={14} className="text-red-500" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {modal && (
        <Modal title={modal.mode === 'new' ? 'Novo Cliente' : 'Editar Cliente'} onClose={close}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Razão Social" required>
                <Input value={form.razao_social} onChange={e => set('razao_social', e.target.value)} />
              </FormField>
              <FormField label="Nome Fantasia">
                <Input value={form.nome_fantasia} onChange={e => set('nome_fantasia', e.target.value)} />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="CNPJ">
                <Input value={form.cnpj} onChange={e => set('cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
              </FormField>
              <FormField label="Telefone">
                <Input value={form.telefone} onChange={e => set('telefone', e.target.value)} />
              </FormField>
            </div>
            <FormField label="E-mail">
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </FormField>
            <FormField label="Endereço">
              <Input value={form.endereco} onChange={e => set('endereco', e.target.value)} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Cidade">
                <Input value={form.cidade} onChange={e => set('cidade', e.target.value)} />
              </FormField>
              <FormField label="Estado">
                <Input value={form.estado} onChange={e => set('estado', e.target.value)} maxLength={2} placeholder="SP" />
              </FormField>
            </div>
            <FormField label="Contato Principal">
              <Input value={form.contato_principal} onChange={e => set('contato_principal', e.target.value)} />
            </FormField>
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
