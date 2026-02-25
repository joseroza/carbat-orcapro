import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Search, Package } from 'lucide-react'
import { api } from '../api/api'
import {
  PageHeader, Card, Button, Modal, FormField, Input, Select, Textarea,
  Table, Spinner, Badge
} from '../components/ui'

const STATUS_OPTIONS = ['pendente', 'em_transito', 'entregue', 'cancelado']
const STATUS_COLOR   = { pendente: 'yellow', em_transito: 'blue', entregue: 'green', cancelado: 'red' }

const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

const EMPTY_FORM = {
  numero: '', proposta_id: '', proposta_numero: '', cliente_nome: '',
  data_emissao: '', data_entrega: '', status: 'pendente',
  endereco_entrega: '', observacoes: '', itens: []
}
const EMPTY_ITEM = { descricao: '', quantidade: 1, unidade: 'UN', peso: '', observacao_item: '' }

export default function RomaneiosPage() {
  const [romaneios, setRomaneios] = useState([])
  const [propostas, setPropostas] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [modal, setModal]         = useState(null)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)

  const load = async () => {
    const [r, p] = await Promise.all([api.romaneios.list(), api.propostas.list()])
    setRomaneios(r); setPropostas(p); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew  = ()  => { setForm(EMPTY_FORM); setModal({ mode: 'new' }) }
  const openEdit = (r) => { setForm({ ...r, itens: r.itens || [] }); setModal({ mode: 'edit', id: r.id }) }
  const close    = ()  => setModal(null)
  const set      = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleProposta = (id) => {
    const p = propostas.find(x => x.id === id)
    set('proposta_id', id)
    if (p) { set('proposta_numero', p.numero); set('cliente_nome', p.cliente_nome) }
  }

  const addItem = () => setForm(f => ({ ...f, itens: [...f.itens, { ...EMPTY_ITEM }] }))
  const delItem = (i) => setForm(f => ({ ...f, itens: f.itens.filter((_, idx) => idx !== i) }))
  const setItem = (i, k, v) => setForm(f => ({
    ...f,
    itens: f.itens.map((item, idx) => idx === i ? { ...item, [k]: v } : item)
  }))

  const save = async () => {
    if (!form.numero.trim()) return alert('Número é obrigatório')
    setSaving(true)
    try {
      if (modal.mode === 'new') await api.romaneios.create(form)
      else                      await api.romaneios.update(modal.id, form)
      await load(); close()
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  const del = async (id) => {
    if (!confirm('Excluir este romaneio?')) return
    await api.romaneios.delete(id); load()
  }

  const filtered = romaneios.filter(r =>
    (r.numero + r.cliente_nome + r.status + r.proposta_numero).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8">
      <PageHeader
        title="Romaneios"
        subtitle={`${romaneios.length} romaneios`}
        action={<Button onClick={openNew}><Plus size={16} /> Novo Romaneio</Button>}
      />

      <Card>
        <div className="p-4 border-b flex items-center gap-3">
          <Search size={16} className="text-slate-400" />
          <input className="flex-1 text-sm outline-none" placeholder="Buscar romaneios..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? <Spinner /> : (
          <Table
            headers={['Número', 'Cliente', 'Proposta', 'Emissão', 'Entrega', 'Status', '']}
            empty={filtered.length === 0 ? 'Nenhum romaneio encontrado' : ''}
          >
            {filtered.map(r => (
              <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4 font-mono text-sm text-slate-700">{r.numero}</td>
                <td className="py-3 px-4 font-medium text-slate-800">{r.cliente_nome || '—'}</td>
                <td className="py-3 px-4 text-slate-600 text-xs">{r.proposta_numero || '—'}</td>
                <td className="py-3 px-4 text-slate-500 text-xs">{fmtDate(r.data_emissao)}</td>
                <td className="py-3 px-4 text-slate-500 text-xs">{fmtDate(r.data_entrega)}</td>
                <td className="py-3 px-4"><Badge color={STATUS_COLOR[r.status] || 'gray'}>{r.status}</Badge></td>
                <td className="py-3 px-4">
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(r)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="sm" onClick={() => del(r.id)}><Trash2 size={14} className="text-red-500" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {modal && (
        <Modal title={modal.mode === 'new' ? 'Novo Romaneio' : 'Editar Romaneio'} onClose={close} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <FormField label="Número" required>
                <Input value={form.numero} onChange={e => set('numero', e.target.value)} placeholder="ROM-2024-001" />
              </FormField>
              <FormField label="Status">
                <Select value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </FormField>
              <FormField label="Proposta Vinculada">
                <Select value={form.proposta_id} onChange={e => handleProposta(e.target.value)}>
                  <option value="">Selecione...</option>
                  {propostas.map(p => <option key={p.id} value={p.id}>{p.numero} — {p.titulo}</option>)}
                </Select>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Cliente">
                <Input value={form.cliente_nome} onChange={e => set('cliente_nome', e.target.value)} />
              </FormField>
              <FormField label="Endereço de Entrega">
                <Input value={form.endereco_entrega} onChange={e => set('endereco_entrega', e.target.value)} />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Data de Emissão">
                <Input type="date" value={form.data_emissao} onChange={e => set('data_emissao', e.target.value)} />
              </FormField>
              <FormField label="Data de Entrega">
                <Input type="date" value={form.data_entrega} onChange={e => set('data_entrega', e.target.value)} />
              </FormField>
            </div>

            {/* Itens */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-3">
                <p className="font-medium text-slate-700 text-sm">Itens do Romaneio</p>
                <Button size="sm" onClick={addItem}><Plus size={14} /> Adicionar Item</Button>
              </div>
              {form.itens.length === 0 ? (
                <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                  <Package size={20} className="mx-auto mb-1 opacity-50" />
                  <p className="text-sm">Nenhum item</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {form.itens.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded-lg">
                      <div className="col-span-5">
                        <label className="text-xs text-slate-500 mb-1 block">Descrição</label>
                        <Input value={item.descricao} onChange={e => setItem(i, 'descricao', e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-slate-500 mb-1 block">Quantidade</label>
                        <Input type="number" value={item.quantidade} onChange={e => setItem(i, 'quantidade', e.target.value)} />
                      </div>
                      <div className="col-span-1">
                        <label className="text-xs text-slate-500 mb-1 block">Un</label>
                        <Input value={item.unidade} onChange={e => setItem(i, 'unidade', e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-slate-500 mb-1 block">Peso (kg)</label>
                        <Input type="number" value={item.peso} onChange={e => setItem(i, 'peso', e.target.value)} />
                      </div>
                      <div className="col-span-1">
                        <label className="text-xs text-slate-500 mb-1 block">Obs</label>
                        <Input value={item.observacao_item} onChange={e => setItem(i, 'observacao_item', e.target.value)} />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button variant="ghost" size="sm" onClick={() => delItem(i)}>
                          <Trash2 size={14} className="text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <FormField label="Observações">
              <Textarea rows={2} value={form.observacoes} onChange={e => set('observacoes', e.target.value)} />
            </FormField>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <Button variant="secondary" onClick={close}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar Romaneio'}</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
