import { useState, useEffect } from 'react'
import { FileText, Users, Truck, DollarSign } from 'lucide-react'
import { api } from '../api/api'
import { PageHeader, StatCard, Card, Badge, Spinner } from '../components/ui'

const statusColor = {
  rascunho:  'gray',
  enviada:   'blue',
  aprovada:  'green',
  perdida:   'red',
  cancelada: 'red',
}

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

export default function DashboardPage() {
  const [data, setData] = useState({ clientes: [], propostas: [], romaneios: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.clientes.list(), api.propostas.list(), api.romaneios.list()])
      .then(([clientes, propostas, romaneios]) => setData({ clientes, propostas, romaneios }))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8"><Spinner /></div>

  const totalAprovado = data.propostas
    .filter(p => p.status === 'aprovada')
    .reduce((s, p) => s + Number(p.valor_total || 0), 0)

  const recentes = data.propostas.slice(0, 5)

  return (
    <div className="p-8">
      <PageHeader title="Dashboard" subtitle="Visão geral do sistema" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Clientes"         value={data.clientes.length}   icon={Users}     color="blue"   />
        <StatCard label="Propostas"        value={data.propostas.length}  icon={FileText}  color="purple" />
        <StatCard label="Romaneios"        value={data.romaneios.length}  icon={Truck}     color="orange" />
        <StatCard label="Total Aprovado"   value={fmt(totalAprovado)}     icon={DollarSign} color="green" />
      </div>

      <Card>
        <div className="p-5 border-b">
          <h2 className="font-semibold text-slate-800">Últimas Propostas</h2>
        </div>
        {recentes.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">Nenhuma proposta ainda</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {recentes.map(p => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-medium text-slate-800 text-sm">{p.titulo}</p>
                  <p className="text-xs text-slate-500">{p.cliente_nome} · {p.numero}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-slate-700">{fmt(p.valor_total)}</span>
                  <Badge color={statusColor[p.status] || 'gray'}>{p.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
