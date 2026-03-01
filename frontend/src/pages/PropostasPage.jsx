import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Search, X, ChevronDown, ChevronUp, FileText, FileDown, AlertTriangle, Filter } from 'lucide-react'
import { api } from '../api/api'
import { PageHeader, Card, Table, Spinner, Badge } from '../components/ui'
import { gerarPDF, gerarDOCX, fmtDateDisplay, buildFilename } from '../utils/gerarProposta'

const STATUS_OPTIONS = ['rascunho', 'enviada', 'em_negociacao', 'aprovada', 'perdida', 'cancelada']
const STATUS_COLOR   = { rascunho: 'gray', enviada: 'blue', em_negociacao: 'yellow', aprovada: 'green', perdida: 'red', cancelada: 'red' }
const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function parseDate(val) {
  if (!val) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  if (val.includes('T')) return val.split('T')[0]
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) { const [d,m,y]=val.split('/'); return `${y}-${m}-${d}` }
  return ''
}
function bumpRevisao(rev) {
  if (!rev) return '2.0'
  const n = parseFloat(rev)
  return isNaN(n) ? rev+'.1' : (Math.floor(n)+1)+'.0'
}
function arrToText(arr) { return (arr||[]).filter(Boolean).join('\n') }
function textToArr(text, knownOpts) {
  if (!text) return { selected:[], extra:[] }
  const lines = text.split('\n').map(l=>l.trim()).filter(Boolean)
  const selected=[], extra=[]
  for (const line of lines) { if(knownOpts.includes(line)) selected.push(line); else extra.push(line) }
  return { selected, extra }
}
function parseImpostos(text) {
  const base = { icms:false,icms_val:'17',ipi:false,ipi_val:'',pis:false,pis_val:'0.65',cofins:false,cofins_val:'3.00',iss:false,iss_val:'',ncm:'73089010',cod_servico:'' }
  if (!text) return base
  for (const l of text.split('\n')) {
    const m=(pat)=>l.match(pat)
    if(m(/ICMS:/))    { base.icms=true;   base.icms_val  =(m(/ICMS:\s*([\d.]+)/)||[])[1]||'17'   }
    if(m(/IPI:/))     { base.ipi=true;    base.ipi_val   =(m(/IPI:\s*([\d.]+)/)||[])[1]||''      }
    if(m(/PIS:/))     { base.pis=true;    base.pis_val   =(m(/PIS:\s*([\d.]+)/)||[])[1]||'0.65'  }
    if(m(/COFINS:/))  { base.cofins=true; base.cofins_val=(m(/COFINS:\s*([\d.]+)/)||[])[1]||'3.00'}
    if(m(/ISS:/))     { base.iss=true;    base.iss_val   =(m(/ISS:\s*(.+)/)||[])[1]?.trim()||''   }
    if(m(/NCM:/))     { base.ncm         =(m(/NCM:\s*(.+)/)||[])[1]?.trim()||''                   }
    if(m(/Cód\. Serviço:/)) { base.cod_servico=(m(/Cód\. Serviço:\s*(.+)/)||[])[1]?.trim()||''    }
  }
  return base
}
function parseDocs(text) {
  if (!text) return { docs:[], enviado_por:'', data:'' }
  const parts = text.split('\n\nEnviados por ')
  const docs = parts[0].split('\n').map(l=>l.trim()).filter(Boolean)
  let enviado_por='', data=''
  if (parts[1]) { const m=parts[1].match(/^(.+), no dia (.+)\.$/)
    if (m) { enviado_por=m[1]; data=parseDate(m[2]) } }
  return { docs, enviado_por, data }
}
function parseTransporte(text) {
  if (!text) return { tipo:'CIF', local:'' }
  const lines = text.split('\n')
  return { tipo:lines[0]?.trim()||'CIF', local:lines[1]?.replace('Local: ','').trim()||'' }
}

const ESCOPO_OPTS = [
  'Mão de obra especializada;',
  'Mão de obra especializada, contratada pela RGF Montagens Industriais Ltda (CNPJ 49.551.973/0001-08);',
  'Matéria prima conforme solicitação;','Consumíveis do Processo Produtivo;',
  'Ferramental e/ou Equipamentos;','Inspeção Visual de Solda;',
  'Inspeção Dimensional;','Alojamento, alimentação e transporte;',
]
const FORA_ESCOPO_OPTS = [
  'ART;','Descarga de materiais na obra;',
  'Documentação para liberação das atividades na área;','Elementos de fixação;',
  'Energia elétrica; Água; Local para refeições e sanitários;','Inspetor qualificado;',
  'Local para estoque do material, próximo ao local da instalação;','Montagem e instalação na obra;',
  'Mão de obra especializada, contratada pela RGF Montagens Industriais Ltda (CNPJ 49.551.973/0001-08);',
  'Obras Civis;','Partes Civis e Elétricas;','Projeto;','Topografia;',
  'Transporte vertical e horizontal (caminhão Munck, PTA, Guindaste e etc);',
  'Alojamento, alimentação e transporte;',
]
const TRATAMENTO_OPTS = [
  'Galvanização à fogo.','Aço carbono: Jateado e pintado, conforme padrão da obra.',
  'Aço carbono: Galvanizado e pintado, conforme padrão da obra.',
  'Inox: decapagem e passivação','Sem Tratamento',
]
const DATABOOK_OPTS = [
  'Certificado de consumíveis;','Certificado de matéria prima;',
  'Certificado de Galvanização à fogo;','Certificado de Pintura;',
]
const PAGAMENTO_OPTS = [
  { value:'30 DDL, após a emissão da Notas Fiscal.',              label:'30 DDL após NF' },
  { value:'Sinal de 50% na aprovação do pedido e 50% na entrega.',label:'50% Sinal / 50% Entrega' },
  { value:'PIX',                                                   label:'Pagamento via PIX' },
  { value:'Conforme medição mensal de serviços executados.',       label:'Medição Mensal' },
  { value:'Pagamento antecipado com 5% de desconto.',             label:'Antecipado (-5%)' },
  { value:'OUTRO',                                                label:'-- Adicionar outra forma --' },
]

function reajusteAtual() {
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const now = new Date()
  return `Preço base: ${meses[now.getMonth()]}/${now.getFullYear()}. Os preços serão reajustados conforme a variação no Índice do Aço – INFOMET, toda vez que ultrapassar 10% de aumento.`
}

const EMPTY_FORM = {
  numero:'',revisao:'1.0',cliente_id:'',cliente_nome:'',contato:'',referencia:'',
  data_proposta:'',titulo:'',tipo_fornecimento:'fornecimento e fabricação',
  status:'rascunho',valor_total:0,observacoes:'',
  reajuste:reajusteAtual(),
  impostos:{icms:true,icms_val:'17',ipi:false,ipi_val:'',pis:true,pis_val:'0.65',cofins:true,cofins_val:'3.00',iss:false,iss_val:'',ncm:'73089010',cod_servico:''},
  pagamento:'30 DDL, após a emissão da Notas Fiscal.',pagamento_personalizado:'',
  validade_texto:'30 (Trinta) dias.',
  prazo_entrega:'Em até 20 dias úteis após recebimento do pedido de compra.',
  garantia:'Garantia Mecânica: A CARBAT garante a CONTRATANTE que irá corrigir, substituir qualquer material com defeito ou que apresente não conformidade, bem como será responsável por defeitos latentes ou ocultos por um período de 12 (doze) meses a contar da data de emissão da NF-e;\nNão nos responsabilizamos por mau uso das peças.',
  escopo:[],escopo_extra:[],fora_escopo:[],fora_escopo_extra:[],
  ensaios:'Não se aplica (teste hidrostático, teste de corrente parasita, ultrassom e LP).',
  tratamento:[],tratamento_extra:[],databook:[],databook_extra:[],
  transporte_tipo:'CIF',transporte_local:'',documentos:[],documentos_enviado_por:'',documentos_data:'',itens:[]
}

function buildForm(p) {
  const escopo=textToArr(p.escopo||'',ESCOPO_OPTS), fora=textToArr(p.fora_escopo||'',FORA_ESCOPO_OPTS)
  const trat=textToArr(p.tratamento||'',TRATAMENTO_OPTS), dbook=textToArr(p.databook||'',DATABOOK_OPTS)
  const trans=parseTransporte(p.transporte), docs=parseDocs(p.documentos)
  const imp=typeof p.impostos==='string'?parseImpostos(p.impostos):(p.impostos||EMPTY_FORM.impostos)
  const knownPag=PAGAMENTO_OPTS.map(o=>o.value).filter(v=>v!=='OUTRO')
  const storedPag=p.condicoes_pagamento||p.pagamento||EMPTY_FORM.pagamento
  const isKnown=knownPag.includes(storedPag)
  return {
    ...EMPTY_FORM,...p,
    data_proposta:parseDate(p.data_proposta), documentos_data:parseDate(p.documentos_data),
    impostos:imp,
    pagamento:isKnown?storedPag:'OUTRO', pagamento_personalizado:isKnown?'':storedPag,
    validade_texto:p.validade_texto||EMPTY_FORM.validade_texto,
    escopo:escopo.selected,escopo_extra:escopo.extra,
    fora_escopo:fora.selected,fora_escopo_extra:fora.extra,
    tratamento:trat.selected,tratamento_extra:trat.extra,
    databook:dbook.selected,databook_extra:dbook.extra,
    transporte_tipo:trans.tipo,transporte_local:trans.local,
    documentos:docs.docs,documentos_enviado_por:docs.enviado_por,documentos_data:docs.data,
    itens:Array.isArray(p.itens)?p.itens:[],
  }
}

function gerarProximoNumero(propostas) {
  const BASE = 260000
  if (!propostas || propostas.length === 0) return String(BASE + 1)
  let maxSeq = 0
  for (const p of propostas) {
    const num = parseInt((p.numero || '').replace(/\D/g, ''), 10)
    if (!isNaN(num) && num > BASE) {
      const seq = num - BASE
      if (seq > maxSeq) maxSeq = seq
    }
  }
  return String(BASE + maxSeq + 1)
}

function Section({ title, children, defaultOpen=true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden mb-4">
      <button type="button" onClick={()=>setOpen(o=>!o)}
        className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
        <span className="text-sm font-semibold text-blue-700 uppercase tracking-wide">{title}</span>
        {open?<ChevronUp size={16} className="text-slate-400"/>:<ChevronDown size={16} className="text-slate-400"/>}
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  )
}
function Field({ label, required, children, full }) {
  return (
    <div className={full?'col-span-2':''}>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
        {label}{required&&<span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
const inp = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
const sel = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"

function CheckGroup({ options, selected, onToggle, extras, onAddExtra, onRemoveExtra, onChangeExtra }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1">
      {options.map((opt,i)=>(
        <label key={i} className="flex items-start gap-2 text-sm cursor-pointer hover:bg-white rounded px-2 py-1.5 transition-colors">
          <input type="checkbox" className="mt-0.5 accent-blue-600" checked={selected.includes(opt)} onChange={()=>onToggle(opt)} />
          <span className="text-slate-700">{opt}</span>
        </label>
      ))}
      {extras.map((val,i)=>(
        <div key={i} className="flex gap-2 items-center mt-1">
          <input className={inp} value={val} placeholder="Digite um item adicional..." onChange={e=>onChangeExtra(i,e.target.value)} />
          <button type="button" onClick={()=>onRemoveExtra(i)} className="text-red-500 hover:text-red-700 p-1 flex-shrink-0"><X size={14}/></button>
        </div>
      ))}
      <button type="button" onClick={onAddExtra} className="mt-2 text-xs bg-slate-500 text-white px-3 py-1.5 rounded hover:bg-slate-600 w-fit">+ Adicionar Item</button>
    </div>
  )
}

function PropostaModal({ modal, clientes, onClose, onSaved }) {
  const [form, setForm]     = useState(modal.form)
  const [saving, setSaving] = useState(false)
  const isEdit = modal.mode === 'edit'
  const clientesDisponiveis = clientes.filter(c => c.aprovado === true || c.aprovado === false)
  const set    = (k,v) => setForm(f=>({...f,[k]:v}))
  const setImp = (k,v) => setForm(f=>({...f,impostos:{...f.impostos,[k]:v}}))
  const toggleCheck = (field,val) => setForm(f=>({...f,[field]:f[field].includes(val)?f[field].filter(x=>x!==val):[...f[field],val]}))
  const addExtra    = (field) => setForm(f=>({...f,[field]:[...f[field],'']}))
  const removeExtra = (field,i) => setForm(f=>({...f,[field]:f[field].filter((_,idx)=>idx!==i)}))
  const changeExtra = (field,i,v) => setForm(f=>({...f,[field]:f[field].map((x,idx)=>idx===i?v:x)}))
  const addItem    = () => setForm(f=>({...f,itens:[...f.itens,{descricao:'',un:'Kg',qtd:1,valor:0}]}))
  const removeItem = (i) => setForm(f=>{const itens=f.itens.filter((_,idx)=>idx!==i);return{...f,itens,valor_total:itens.reduce((s,it)=>s+(Number(it.qtd)||0)*(Number(it.valor)||0),0)}})
  const setItem    = (i,k,v) => setForm(f=>{const itens=f.itens.map((it,idx)=>idx!==i?it:{...it,[k]:v});return{...f,itens,valor_total:itens.reduce((s,it)=>s+(Number(it.qtd)||0)*(Number(it.valor)||0),0)}})
  const addDoc     = () => setForm(f=>({...f,documentos:[...f.documentos,'']}))
  const removeDoc  = (i) => setForm(f=>({...f,documentos:f.documentos.filter((_,idx)=>idx!==i)}))
  const setDoc     = (i,v) => setForm(f=>({...f,documentos:f.documentos.map((x,idx)=>idx===i?v:x)}))
  const handleClienteChange = (digitado) => {
    const cliente = clientesDisponiveis.find(c => c.razao_social === digitado)
    if (cliente) {
      const reprovado = cliente.aprovado === false
      setForm(f => ({ ...f, cliente_id: cliente.id, cliente_nome: cliente.razao_social, contato: cliente.contato_principal || f.contato, pagamento: reprovado ? 'PIX' : f.pagamento }))
    } else {
      setForm(f => ({ ...f, cliente_nome: digitado, cliente_id: '' }))
    }
  }
  function serializeImpostos(imp) {
    const parts=[]
    if(imp.icms)   parts.push(`• ICMS: ${imp.icms_val}%`)
    if(imp.ipi)    parts.push(`• IPI: ${imp.ipi_val}%`)
    if(imp.pis)    parts.push(`• PIS: ${imp.pis_val}% (Incluso)`)
    if(imp.cofins) parts.push(`• COFINS: ${imp.cofins_val}% (Incluso)`)
    if(imp.iss)    parts.push(`• ISS: ${imp.iss_val}`)
    if(imp.ncm)    parts.push(`• NCM: ${imp.ncm}`)
    if(imp.cod_servico) parts.push(`• Cód. Serviço: ${imp.cod_servico}`)
    return parts.join('\n')
  }
  const save = async () => {
    if (!form.titulo.trim()) return alert('Título é obrigatório')
    setSaving(true)
    try {
      const revisao = isEdit ? bumpRevisao(form.revisao) : form.revisao
      const payload = {
        ...form, revisao, valor_total:Number(form.valor_total)||0,
        impostos:serializeImpostos(form.impostos),
        condicoes_pagamento:form.pagamento==='OUTRO'?form.pagamento_personalizado:form.pagamento,
        escopo:      arrToText([...form.escopo,      ...form.escopo_extra]),
        fora_escopo: arrToText([...form.fora_escopo, ...form.fora_escopo_extra]),
        tratamento:  arrToText([...form.tratamento,  ...form.tratamento_extra]),
        databook:    arrToText([...form.databook,    ...form.databook_extra]),
        transporte:  form.transporte_tipo+'\nLocal: '+form.transporte_local,
        documentos:  form.documentos.filter(Boolean).join('\n')+(form.documentos_enviado_por?`\n\nEnviados por ${form.documentos_enviado_por}, no dia ${fmtDateDisplay(form.documentos_data)}.`:''),
        itens:form.itens.filter(it=>it.descricao.trim()),
      }
      if (modal.mode==='new') await api.propostas.create(payload)
      else                    await api.propostas.update(modal.id,payload)
      onSaved()
    } catch(e) { alert(e.message) }
    finally { setSaving(false) }
  }
  const totalGeral = form.itens.reduce((s,it)=>s+(Number(it.qtd)||0)*(Number(it.valor)||0),0)
  const nextRev    = isEdit ? bumpRevisao(form.revisao) : form.revisao
  const filename   = buildFilename(form)
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-4">
        <div className="flex items-center justify-between p-5 border-b bg-white rounded-t-2xl sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <img src="https://carbat.com.br/wp-content/uploads/2024/06/Carbat-logo-sem-fundo--e1746032537163.png" alt="Carbat" className="h-8 object-contain"/>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">{isEdit?'Editar Proposta Comercial':'Nova Proposta Comercial'}</h2>
              {isEdit&&<p className="text-xs text-amber-600 font-medium">⚠ Ao salvar, a revisão será automaticamente atualizada para Rev. {nextRev}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={20}/></button>
        </div>
        <div className="p-5">
          <Section title="Cabeçalho da Proposta">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Contratante">
                <input list="lista-clientes" className={inp} value={form.cliente_nome || ''} onChange={e => handleClienteChange(e.target.value)} placeholder="Digite ou selecione um cliente..."/>
                <datalist id="lista-clientes">
                  {clientesDisponiveis.map(c => (<option key={c.id} value={c.razao_social}>{c.aprovado === false ? '⚠ Reprovado' : c.nome_fantasia || ''}</option>))}
                </datalist>
                {clientes.some(c => c.razao_social === form.cliente_nome && c.aprovado === false) && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                    <AlertTriangle size={12} className="flex-shrink-0"/>
                    Cliente reprovado — pagamento alterado para PIX automaticamente.
                  </div>
                )}
              </Field>
              <Field label="A/C (Contato)">
                <input className={inp} value={form.contato} onChange={e=>set('contato',e.target.value)} placeholder="Nome do responsável"/>
              </Field>
              <Field label="Referência">
                <input className={inp} value={form.referencia} onChange={e=>set('referencia',e.target.value)} placeholder="Ex: Projeto Arauco"/>
              </Field>
              <Field label="Data">
                <input type="date" className={inp} value={form.data_proposta} onChange={e=>set('data_proposta',e.target.value)}/>
              </Field>
              <Field label="Nº da Proposta">
                <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-100">
                  <span className="px-3 py-2 text-sm font-mono font-bold text-slate-700 flex-1">{form.numero || '—'}</span>
                  <span className="px-3 py-2 text-xs text-slate-400 bg-slate-100 border-l border-slate-200 select-none">automático</span>
                </div>
              </Field>
              <Field label="Revisão atual">
                <input className={`${inp} bg-slate-100 text-slate-500`} value={form.revisao} readOnly title="Incrementada automaticamente ao salvar"/>
              </Field>
              <Field label="Título / Objeto" required full>
                <input className={inp} value={form.titulo} onChange={e=>set('titulo',e.target.value)} placeholder="Ex: Fabricação de estrutura metálica"/>
              </Field>
              <Field label="Tipo de Fornecimento" full>
                <select className={sel} value={form.tipo_fornecimento} onChange={e=>set('tipo_fornecimento',e.target.value)}>
                  <option value="fornecimento e fabricação">Fornecimento e fabricação</option>
                  <option value="fornecimento e fabricação, montagem e instalação">Fornecimento e fabricação, montagem e instalação</option>
                  <option value="montagem e instalação">Montagem e instalação</option>
                </select>
              </Field>
              <Field label="Status">
                <select className={sel} value={form.status} onChange={e=>set('status',e.target.value)}>
                  {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            {(form.numero||form.cliente_nome||form.titulo)&&(
              <div className="mt-4 bg-slate-800 rounded-lg px-4 py-3">
                <p className="text-xs text-slate-400 mb-1">Nome do arquivo ao exportar:</p>
                <p className="text-xs font-mono text-green-400 break-all">{filename}</p>
              </div>
            )}
          </Section>
          <Section title="1. Itens do Orçamento">
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="bg-blue-700 text-white px-3 py-2.5 text-center w-10 font-medium">#</th>
                    <th className="bg-blue-700 text-white px-3 py-2.5 text-left font-medium">Descrição de Fabricação</th>
                    <th className="bg-blue-700 text-white px-3 py-2.5 w-16 font-medium text-center">Un.</th>
                    <th className="bg-blue-700 text-white px-3 py-2.5 w-20 font-medium text-center">Qtd.</th>
                    <th className="bg-blue-700 text-white px-3 py-2.5 w-28 font-medium text-right">Unit. (R$)</th>
                    <th className="bg-blue-700 text-white px-3 py-2.5 w-32 font-medium text-right">Total (R$)</th>
                    <th className="bg-blue-700 text-white px-3 py-2.5 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.itens.length===0&&(<tr><td colSpan={7} className="py-8 text-center text-slate-400 text-sm italic">Clique em "+ Adicionar Novo Item" para começar</td></tr>)}
                  {form.itens.map((it,i)=>(
                    <tr key={i} className={`border-t border-slate-100 ${i%2===0?'bg-white':'bg-slate-50'}`}>
                      <td className="px-3 py-2 text-center text-slate-400 text-xs">{i+1}</td>
                      <td className="px-2 py-1"><textarea className="w-full text-sm resize-none border-0 outline-none bg-transparent min-h-[36px] p-1" rows={1} value={it.descricao} placeholder="Descrição do item" onChange={e=>setItem(i,'descricao',e.target.value)}/></td>
                      <td className="px-2 py-1"><input className="w-full text-sm border-0 outline-none bg-transparent text-center" value={it.un} onChange={e=>setItem(i,'un',e.target.value)}/></td>
                      <td className="px-2 py-1"><input type="number" className="w-full text-sm border-0 outline-none bg-transparent text-center" value={it.qtd} min={1} onChange={e=>setItem(i,'qtd',e.target.value)}/></td>
                      <td className="px-2 py-1"><input type="number" className="w-full text-sm border-0 outline-none bg-transparent text-right" value={it.valor} step="0.01" min={0} onChange={e=>setItem(i,'valor',e.target.value)}/></td>
                      <td className="px-3 py-1 font-bold text-slate-700 text-right text-sm">{((Number(it.qtd)||0)*(Number(it.valor)||0)).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                      <td className="px-2 py-1 text-center"><button type="button" onClick={()=>removeItem(i)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"><X size={14}/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-3">
              <button type="button" onClick={addItem} className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors">+ Adicionar Novo Item</button>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-5 py-2.5 font-bold text-blue-900 text-base">TOTAL GERAL:&nbsp;{totalGeral.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
            </div>
          </Section>
          <Section title="Observações Gerais" defaultOpen={false}>
            <textarea className={`${inp} min-h-[80px]`} rows={3} value={form.observacoes} onChange={e=>set('observacoes',e.target.value)} placeholder="Descreva observações técnicas ou comerciais adicionais..."/>
            <p className="text-xs text-slate-400 italic mt-1">*Se deixado em branco, não aparecerá na proposta final.</p>
          </Section>
          <Section title="Condições Gerais e Escopo" defaultOpen={false}>
            <div className="space-y-5">
              <Field label="Reajuste"><textarea className={`${inp} min-h-[55px]`} rows={2} value={form.reajuste} onChange={e=>set('reajuste',e.target.value)}/></Field>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Tributos e Encargos Fiscais</label>
                <div className="grid grid-cols-2 gap-3 bg-blue-50 p-4 rounded-lg border border-blue-200">
                  {[{chk:'icms',val:'icms_val',label:'ICMS (%)'},{chk:'ipi',val:'ipi_val',label:'IPI (%)'},{chk:'pis',val:'pis_val',label:'PIS (%)'},{chk:'cofins',val:'cofins_val',label:'COFINS (%)'},{chk:'iss',val:'iss_val',label:'ISS (%)'}].map(({chk,val,label})=>(
                    <div key={chk} className="bg-white rounded-lg p-3 border border-slate-200 flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" className="accent-blue-600" checked={!!form.impostos[chk]} onChange={e=>setImp(chk,e.target.checked)}/><span className="font-medium text-slate-700">{label}</span></label>
                      <input className={inp} value={form.impostos[val]} onChange={e=>setImp(val,e.target.value)} placeholder="0"/>
                    </div>
                  ))}
                  <div className="bg-white rounded-lg p-3 border border-slate-200 flex flex-col gap-2"><label className="text-sm font-medium text-slate-700">NCM</label><input className={inp} value={form.impostos.ncm} onChange={e=>setImp('ncm',e.target.value)}/></div>
                  <div className="bg-white rounded-lg p-3 border border-slate-200 flex flex-col gap-2 col-span-2"><label className="text-sm font-medium text-slate-700">Código do Serviço</label><input className={inp} value={form.impostos.cod_servico} onChange={e=>setImp('cod_servico',e.target.value)} placeholder="Ex: 14.01"/></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Condições de Pagamento">
                  <select className={sel} value={form.pagamento} onChange={e=>set('pagamento',e.target.value)}>{PAGAMENTO_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
                  {form.pagamento==='OUTRO'&&(<input className={`${inp} mt-2`} value={form.pagamento_personalizado} onChange={e=>set('pagamento_personalizado',e.target.value)} placeholder="Descreva a condição de pagamento"/>)}
                </Field>
                <Field label="Validade da Proposta Comercial"><input className={inp} value={form.validade_texto} onChange={e=>set('validade_texto',e.target.value)}/></Field>
                <Field label="Prazo de Entrega e Capacidade Produtiva" full><input className={inp} value={form.prazo_entrega} onChange={e=>set('prazo_entrega',e.target.value)}/></Field>
              </div>
              <Field label="Garantia"><textarea className={`${inp} min-h-[90px]`} rows={4} value={form.garantia} onChange={e=>set('garantia',e.target.value)}/><p className="text-xs text-slate-400 italic mt-1">*Se deixado em branco, não aparecerá na proposta final.</p></Field>
              <Field label="Escopo de Fornecimento"><CheckGroup options={ESCOPO_OPTS} selected={form.escopo} onToggle={v=>toggleCheck('escopo',v)} extras={form.escopo_extra} onAddExtra={()=>addExtra('escopo_extra')} onRemoveExtra={i=>removeExtra('escopo_extra',i)} onChangeExtra={(i,v)=>changeExtra('escopo_extra',i,v)}/></Field>
              <Field label="Fora de Escopo / Escopo Contratante"><CheckGroup options={FORA_ESCOPO_OPTS} selected={form.fora_escopo} onToggle={v=>toggleCheck('fora_escopo',v)} extras={form.fora_escopo_extra} onAddExtra={()=>addExtra('fora_escopo_extra')} onRemoveExtra={i=>removeExtra('fora_escopo_extra',i)} onChangeExtra={(i,v)=>changeExtra('fora_escopo_extra',i,v)}/></Field>
              <Field label="Ensaios Não Destrutivos"><input className={inp} value={form.ensaios} onChange={e=>set('ensaios',e.target.value)}/></Field>
              <Field label="Tratamento Anticorrosivo"><CheckGroup options={TRATAMENTO_OPTS} selected={form.tratamento} onToggle={v=>toggleCheck('tratamento',v)} extras={form.tratamento_extra} onAddExtra={()=>addExtra('tratamento_extra')} onRemoveExtra={i=>removeExtra('tratamento_extra',i)} onChangeExtra={(i,v)=>changeExtra('tratamento_extra',i,v)}/></Field>
              <Field label="Data Book Técnico"><CheckGroup options={DATABOOK_OPTS} selected={form.databook} onToggle={v=>toggleCheck('databook',v)} extras={form.databook_extra} onAddExtra={()=>addExtra('databook_extra')} onRemoveExtra={i=>removeExtra('databook_extra',i)} onChangeExtra={(i,v)=>changeExtra('databook_extra',i,v)}/></Field>
              <Field label="Condições de Transporte e Logística">
                <select className={`${sel} mb-2`} value={form.transporte_tipo} onChange={e=>set('transporte_tipo',e.target.value)}>
                  <option value="CIF">CIF – Frete e seguro sob responsabilidade da Carbat</option>
                  <option value="DDP">DDP – Entrega com todos os custos e impostos sob responsabilidade da Carbat</option>
                  <option value="FOB">FOB – Retirada na fábrica sob responsabilidade do Cliente</option>
                </select>
                <label className="text-xs text-slate-500 mb-1 block">Endereço de Entrega:</label>
                <input className={inp} value={form.transporte_local} onChange={e=>set('transporte_local',e.target.value)} placeholder="Digite o local exato da entrega"/>
              </Field>
              <Field label="Documentos de Referência Recebidos">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  {form.documentos.length===0&&<p className="text-slate-400 text-sm italic text-center py-3">Nenhum documento adicionado ainda.</p>}
                  <div className="space-y-2">{form.documentos.map((doc,i)=>(<div key={i} className="flex gap-2 items-center"><input className={inp} value={doc} onChange={e=>setDoc(i,e.target.value)} placeholder="Ex: Projeto Executivo Rev.02"/><button type="button" onClick={()=>removeDoc(i)} className="text-red-500 hover:text-red-700 p-1 flex-shrink-0"><X size={14}/></button></div>))}</div>
                  <button type="button" onClick={addDoc} className="mt-3 text-xs bg-slate-500 text-white px-3 py-1.5 rounded hover:bg-slate-600">+ Adicionar Documento</button>
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200 mt-4">
                    <div><label className="text-xs text-slate-500 mb-1 block">Enviado por:</label><input className={inp} value={form.documentos_enviado_por} onChange={e=>set('documentos_enviado_por',e.target.value)} placeholder="Ex: contato@empresa.com"/></div>
                    <div><label className="text-xs text-slate-500 mb-1 block">Data de Recebimento:</label><input type="date" className={inp} value={form.documentos_data} onChange={e=>set('documentos_data',e.target.value)}/></div>
                  </div>
                </div>
              </Field>
            </div>
          </Section>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t bg-slate-50 rounded-b-2xl sticky bottom-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors">Cancelar</button>
          <button type="button" onClick={save} disabled={saving} className="px-6 py-2 text-sm rounded-lg bg-blue-700 text-white font-bold hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors uppercase tracking-wide">
            {saving?'Salvando...':isEdit?`Salvar (Rev. ${nextRev})`:'Criar Proposta'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PropostasPage() {
  const [propostas, setPropostas] = useState([])
  const [clientes,  setClientes]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [modal,     setModal]     = useState(null)

  // ── filtros ──────────────────────────────────────────────────────────────────
  const [filtroContratante, setFiltroContratante] = useState('')
  const [filtroReferencia,  setFiltroReferencia]  = useState('')
  const [filtroTitulo,      setFiltroTitulo]      = useState('')
  const [filtrosAbertos,    setFiltrosAbertos]    = useState(false)

  const temFiltroAtivo = filtroContratante || filtroReferencia || filtroTitulo

  const limparFiltros = () => {
    setFiltroContratante(''); setFiltroReferencia(''); setFiltroTitulo(''); setSearch('')
  }

  const load = async () => {
    const [p,c] = await Promise.all([api.propostas.list(), api.clientes.list()])
    setPropostas(p); setClientes(c); setLoading(false)
  }
  useEffect(()=>{ load() },[])

  const openNew = () => {
    const proximoNumero = gerarProximoNumero(propostas)
    setModal({ mode:'new', form:{ ...EMPTY_FORM, numero: proximoNumero, data_proposta:new Date().toISOString().split('T')[0] } })
  }
  const openEdit = (p) => setModal({ mode:'edit', id:p.id, form:buildForm(p) })
  const close    = () => setModal(null)
  const del = async (id) => {
    if (!confirm('Excluir esta proposta?')) return
    await api.propostas.delete(id); load()
  }
  const updateStatus = async (proposta, novoStatus) => {
    try {
      await api.propostas.update(proposta.id, { ...proposta, status: novoStatus })
      setPropostas(prev => prev.map(x => x.id === proposta.id ? { ...x, status: novoStatus } : x))
    } catch(e) { alert(e.message) }
  }

  // ── filtragem combinada ───────────────────────────────────────────────────────
  const filtered = propostas.filter(p => {
    const q = search.toLowerCase()
    const matchSearch      = !q || (p.titulo+p.cliente_nome+p.numero+p.status).toLowerCase().includes(q)
    const matchContratante = !filtroContratante || (p.cliente_nome||'').toLowerCase().includes(filtroContratante.toLowerCase())
    const matchReferencia  = !filtroReferencia  || (p.referencia||'').toLowerCase().includes(filtroReferencia.toLowerCase())
    const matchTitulo      = !filtroTitulo      || (p.titulo||'').toLowerCase().includes(filtroTitulo.toLowerCase())
    return matchSearch && matchContratante && matchReferencia && matchTitulo
  })

  const contratantesUnicos = [...new Set(propostas.map(p => p.cliente_nome).filter(Boolean))].sort()

  return (
    <div className="p-8">
      <PageHeader
        title="Propostas Comerciais"
        subtitle={`${filtered.length} de ${propostas.length} proposta${propostas.length!==1?'s':''}`}
        action={
          <button onClick={openNew} className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-800 transition-colors">
            <Plus size={16}/> Nova Proposta
          </button>
        }
      />

      <Card>
        {/* barra de busca + botão filtros */}
        <div className="p-4 border-b flex items-center gap-3">
          <Search size={16} className="text-slate-400 flex-shrink-0"/>
          <input className="flex-1 text-sm outline-none bg-transparent"
            placeholder="Busca rápida por título, cliente, número ou status..."
            value={search} onChange={e=>setSearch(e.target.value)}/>
          <button
            onClick={() => setFiltrosAbertos(o => !o)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
              temFiltroAtivo ? 'bg-blue-700 text-white border-blue-700' : 'text-slate-500 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Filter size={13}/>
            Filtros
            {temFiltroAtivo && (
              <span className="bg-white text-blue-700 rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold">
                {[filtroContratante, filtroReferencia, filtroTitulo].filter(Boolean).length}
              </span>
            )}
          </button>
          {temFiltroAtivo && (
            <button onClick={limparFiltros} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors">
              <X size={12}/> Limpar
            </button>
          )}
        </div>

        {/* painel de filtros */}
        {filtrosAbertos && (
          <div className="px-4 py-3 border-b bg-slate-50 grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Contratante</label>
              <input
                list="filtro-contratantes"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Filtrar por empresa..."
                value={filtroContratante}
                onChange={e => setFiltroContratante(e.target.value)}
              />
              <datalist id="filtro-contratantes">
                {contratantesUnicos.map(c => <option key={c} value={c}/>)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Referência</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Filtrar por referência..."
                value={filtroReferencia}
                onChange={e => setFiltroReferencia(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Título / Objeto</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Filtrar por título..."
                value={filtroTitulo}
                onChange={e => setFiltroTitulo(e.target.value)}
              />
            </div>
          </div>
        )}

        {loading ? <Spinner/> : (
          <Table
            headers={['Número / Rev.','Título','Cliente','Referência','Valor Total','Status','Data','']}
            empty={filtered.length===0?'Nenhuma proposta encontrada':''}
          >
            {filtered.map(p=>(
              <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4 text-xs font-mono text-slate-600">
                  {p.numero||'—'}<span className="ml-1 text-slate-400">Rev.{p.revisao}</span>
                </td>
                <td className="py-3 px-4 font-medium text-slate-800 max-w-xs truncate">{p.titulo}</td>
                <td className="py-3 px-4 text-slate-600 text-sm">{p.cliente_nome||'—'}</td>
                <td className="py-3 px-4 text-slate-500 text-xs">{p.referencia||'—'}</td>
                <td className="py-3 px-4 text-sm font-semibold text-slate-700">{fmt(p.valor_total)}</td>
                <td className="py-3 px-4">
                  <select value={p.status} onChange={e => updateStatus(p, e.target.value)}
                    style={{
                      background: p.status==='aprovada'?'#dcfce7':p.status==='enviada'?'#dbeafe':p.status==='em_negociacao'?'#fef9c3':p.status==='perdida'?'#fee2e2':p.status==='cancelada'?'#fee2e2':'#f1f5f9',
                      color: p.status==='aprovada'?'#15803d':p.status==='enviada'?'#1d4ed8':p.status==='em_negociacao'?'#92400e':p.status==='perdida'?'#b91c1c':p.status==='cancelada'?'#b91c1c':'#475569',
                    }}
                    className="text-xs font-semibold px-2 py-1 rounded-lg border-0 outline-none cursor-pointer transition-all">
                    {STATUS_OPTIONS.map(s => <option key={s} value={s} style={{background:'#fff',color:'#1e293b'}}>{s}</option>)}
                  </select>
                </td>
                <td className="py-3 px-4 text-slate-600 text-xs">{fmtDateDisplay(p.data_proposta)}</td>
                <td className="py-3 px-4">
                  <div className="flex gap-1 justify-end items-center">
                    <button onClick={()=>gerarPDF(buildForm(p))} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="Gerar PDF"><FileText size={14}/></button>
                    <button onClick={()=>gerarDOCX(buildForm(p))} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-700 transition-colors" title="Gerar .DOCX"><FileDown size={14}/></button>
                    <button onClick={()=>openEdit(p)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors" title="Editar"><Pencil size={14}/></button>
                    <button onClick={()=>del(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors" title="Excluir"><Trash2 size={14}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {modal&&(
        <PropostaModal modal={modal} clientes={clientes} onClose={close} onSaved={()=>{load();close()}}/>
      )}
    </div>
  )
}