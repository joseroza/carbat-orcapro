import { useState, useEffect } from 'react'
import { FileText, Users, Truck, DollarSign, TrendingUp, Award } from 'lucide-react'
import { api } from '../api/api'
import { PageHeader, StatCard, Card, Badge, Spinner } from '../components/ui'

const STATUS_COLOR = {
  rascunho:      'gray',
  enviada:       'blue',
  em_negociacao: 'yellow',
  aprovada:      'green',
  perdida:       'red',
  cancelada:     'red',
}

const STATUS_LABEL = {
  rascunho:      'Rascunho',
  enviada:       'Enviada',
  em_negociacao: 'Em Negociação',
  aprovada:      'Aprovada',
  perdida:       'Perdida',
  cancelada:     'Cancelada',
}

const BAR_COLORS = [
  '#3b82f6','#8b5cf6','#f59e0b','#10b981',
  '#ef4444','#06b6d4','#f97316','#6366f1',
]

const fmt  = (v) => Number(v||0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
const fmtK = (v) => {
  if (v >= 1_000_000) return `R$ ${(v/1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$ ${(v/1_000).toFixed(0)}K`
  return fmt(v)
}

// ─── Barra horizontal ─────────────────────────────────────────────────────────
function HBar({ label, value, max, color, count, total }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-36 text-xs text-slate-600 font-medium truncate text-right pr-1" title={label}>{label}</div>
      <div className="flex-1 bg-slate-100 rounded-full h-5 relative overflow-hidden">
        <div
          className="h-5 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
          style={{ width:`${pct}%`, background: color, minWidth: pct > 0 ? 8 : 0 }}
        />
      </div>
      <div className="w-24 text-xs text-slate-700 font-semibold text-right">{fmtK(value)}</div>
      <div className="w-14 text-xs text-slate-400 text-right">{count} prop.</div>
    </div>
  )
}

// ─── Mini donut de status ─────────────────────────────────────────────────────
function StatusDonut({ propostas }) {
  const counts = {}
  for (const p of propostas) counts[p.status] = (counts[p.status]||0) + 1
  const total = propostas.length
  const STATUS_C = { rascunho:'#94a3b8', enviada:'#3b82f6', em_negociacao:'#f59e0b', aprovada:'#10b981', perdida:'#ef4444', cancelada:'#fca5a5' }

  const entries = Object.entries(counts).sort((a,b)=>b[1]-a[1])
  let cumPct = 0
  const segments = entries.map(([status, count]) => {
    const pct = (count / total) * 100
    const seg = { status, count, pct, start: cumPct }
    cumPct += pct
    return seg
  })

  // SVG donut (r=15.9, cx=21, cy=21)
  const R = 15.9, CX = 21, CY = 21
  const circumference = 2 * Math.PI * R

  return (
    <div className="flex items-center gap-6">
      <svg width={84} height={84} viewBox="0 0 42 42">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f1f5f9" strokeWidth={5}/>
        {segments.map(({ status, pct, start }) => (
          <circle key={status} cx={CX} cy={CY} r={R} fill="none"
            stroke={STATUS_C[status]||'#cbd5e1'} strokeWidth={5}
            strokeDasharray={`${(pct/100)*circumference} ${circumference}`}
            strokeDashoffset={`${-((start/100)*circumference - circumference/4)}`}
            style={{ transition:'stroke-dasharray .4s' }}
          />
        ))}
        <text x={CX} y={CY+1.5} textAnchor="middle" fontSize={8} fontWeight="bold" fill="#1e293b">{total}</text>
      </svg>
      <div className="space-y-1.5 flex-1">
        {entries.map(([status, count]) => (
          <div key={status} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_C[status]||'#cbd5e1' }}/>
              <span className="text-xs text-slate-600">{STATUS_LABEL[status]||status}</span>
            </div>
            <span className="text-xs font-semibold text-slate-700">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [data, setData]       = useState({ clientes:[], propostas:[], romaneios:[] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.clientes.list(), api.propostas.list(), api.romaneios.list()])
      .then(([clientes, propostas, romaneios]) => setData({ clientes, propostas, romaneios }))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8"><Spinner/></div>

  const { clientes, propostas, romaneios } = data

  // ── Métricas gerais ──────────────────────────────────────────────────────────
  const totalAprovado = propostas.filter(p=>p.status==='aprovada').reduce((s,p)=>s+Number(p.valor_total||0),0)
  const totalPipeline = propostas.filter(p=>['enviada','em_negociacao'].includes(p.status)).reduce((s,p)=>s+Number(p.valor_total||0),0)

  // ── Por empresa ──────────────────────────────────────────────────────────────
  const porEmpresa = {}
  for (const p of propostas) {
    const nome = p.cliente_nome || '(sem cliente)'
    if (!porEmpresa[nome]) porEmpresa[nome] = { total:0, aprovado:0, count:0, aprovadas:0 }
    porEmpresa[nome].total   += Number(p.valor_total||0)
    porEmpresa[nome].count   += 1
    if (p.status === 'aprovada') {
      porEmpresa[nome].aprovado += Number(p.valor_total||0)
      porEmpresa[nome].aprovadas += 1
    }
  }

  const empresas = Object.entries(porEmpresa)
    .map(([nome, v]) => ({ nome, ...v }))
    .sort((a,b) => b.total - a.total)

  const maxTotal = empresas[0]?.total || 1

  // ── Recentes ─────────────────────────────────────────────────────────────────
  const recentes = propostas.slice(0, 6)

  return (
    <div className="p-8 space-y-6">
      <PageHeader title="Dashboard" subtitle="Visão geral do sistema"/>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Clientes"       value={clientes.length}  icon={Users}      color="blue"   />
        <StatCard label="Propostas"      value={propostas.length} icon={FileText}   color="purple" />
        <StatCard label="Romaneios"      value={romaneios.length} icon={Truck}      color="orange" />
        <StatCard label="Total Aprovado" value={fmt(totalAprovado)} icon={DollarSign} color="green" />
      </div>

      {/* Pipeline + Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Pipeline */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-blue-500"/>
            <h3 className="font-semibold text-slate-700 text-sm">Pipeline Ativo</h3>
          </div>
          <p className="text-2xl font-bold text-slate-800">{fmt(totalPipeline)}</p>
          <p className="text-xs text-slate-400 mt-1">Propostas enviadas + em negociação</p>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-1">Taxa de aprovação</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-100 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: propostas.length > 0 ? `${(propostas.filter(p=>p.status==='aprovada').length/propostas.length)*100}%` : '0%' }}/>
              </div>
              <span className="text-xs font-semibold text-green-600">
                {propostas.length > 0 ? Math.round((propostas.filter(p=>p.status==='aprovada').length/propostas.length)*100) : 0}%
              </span>
            </div>
          </div>
        </Card>

        {/* Distribuição de status */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Award size={16} className="text-purple-500"/>
            <h3 className="font-semibold text-slate-700 text-sm">Distribuição por Status</h3>
          </div>
          {propostas.length === 0
            ? <p className="text-sm text-slate-400 text-center py-4">Nenhuma proposta ainda</p>
            : <StatusDonut propostas={propostas}/>
          }
        </Card>
      </div>

      {/* Gráfico por empresa */}
      <Card>
        <div className="p-5 border-b">
          <h2 className="font-semibold text-slate-800">Propostas por Empresa</h2>
          <p className="text-xs text-slate-400 mt-0.5">Valor total de propostas agrupado por cliente</p>
        </div>
        {empresas.length === 0
          ? <div className="text-center py-10 text-slate-400 text-sm">Nenhuma proposta cadastrada</div>
          : (
          <div className="p-5">
            {/* Cabeçalho das colunas */}
            <div className="flex items-center gap-3 mb-2 pb-2 border-b border-slate-100">
              <div className="w-36 text-right text-xs text-slate-400 uppercase tracking-wide pr-1">Empresa</div>
              <div className="flex-1 text-xs text-slate-400 uppercase tracking-wide">Volume total</div>
              <div className="w-24 text-right text-xs text-slate-400 uppercase tracking-wide">Valor</div>
              <div className="w-14 text-right text-xs text-slate-400 uppercase tracking-wide">Qtd.</div>
            </div>
            {empresas.map((emp, i) => (
              <HBar
                key={emp.nome}
                label={emp.nome}
                value={emp.total}
                max={maxTotal}
                color={BAR_COLORS[i % BAR_COLORS.length]}
                count={emp.count}
                total={emp.total}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Tabela de cards por empresa (aprovado vs total) */}
      {empresas.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {empresas.slice(0,6).map((emp, i) => {
            const taxaAprov = emp.count > 0 ? Math.round((emp.aprovadas/emp.count)*100) : 0
            return (
              <Card key={emp.nome} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ background: BAR_COLORS[i%BAR_COLORS.length] }}/>
                    <p className="text-sm font-semibold text-slate-800 leading-tight">{emp.nome}</p>
                  </div>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{emp.count} prop.</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Total proposto</span>
                    <span className="font-semibold text-slate-700">{fmtK(emp.total)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Total aprovado</span>
                    <span className="font-semibold text-green-600">{fmtK(emp.aprovado)}</span>
                  </div>
                  <div className="pt-1.5">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Aprovação</span>
                      <span className="text-slate-600 font-medium">{taxaAprov}%</span>
                    </div>
                    <div className="bg-slate-100 rounded-full h-1.5">
                      <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width:`${taxaAprov}%` }}/>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Últimas propostas */}
      <Card>
        <div className="p-5 border-b">
          <h2 className="font-semibold text-slate-800">Últimas Propostas</h2>
        </div>
        {recentes.length === 0
          ? <div className="text-center py-10 text-slate-400 text-sm">Nenhuma proposta ainda</div>
          : (
          <div className="divide-y divide-slate-50">
            {recentes.map(p => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-medium text-slate-800 text-sm">{p.titulo}</p>
                  <p className="text-xs text-slate-500">{p.cliente_nome} · {p.numero}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-slate-700">{fmt(p.valor_total)}</span>
                  <Badge color={STATUS_COLOR[p.status]||'gray'}>{p.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
