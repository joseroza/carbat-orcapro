import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Search, X, ChevronDown, ChevronUp, FileText, FileDown } from 'lucide-react'
import { api } from '../api/api'
import { PageHeader, Card, Table, Spinner, Badge } from '../components/ui'

// ─── helpers ──────────────────────────────────────────────────────────────────
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
function fmtDateDisplay(val) {
  const d = parseDate(val); if (!d) return '—'
  const [y,m,day] = d.split('-'); return `${day}/${m}/${y}`
}
function bumpRevisao(rev) {
  if (!rev) return '2.0'
  const n = parseFloat(rev)
  return isNaN(n) ? rev+'.1' : (Math.floor(n)+1)+'.0'
}
function buildFilename(form) {
  const clean = (s) => (s||'').replace(/[/\\?%*:|"<>\s]/g,'_').replace(/_+/g,'_')
  return [clean(form.numero),clean(form.cliente_nome),clean(form.titulo),clean(form.referencia),'Rev'+clean(form.revisao)].filter(Boolean).join('_')
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

// ─── static data ──────────────────────────────────────────────────────────────
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

const EMPTY_FORM = {
  numero:'',revisao:'1.0',cliente_id:'',cliente_nome:'',contato:'',referencia:'',
  data_proposta:'',titulo:'',tipo_fornecimento:'fornecimento e fabricação',
  status:'rascunho',valor_total:0,observacoes:'',
  reajuste:'Preço base: Janeiro/2026. Os preços serão reajustados conforme a variação no Índice do Aço – INFOMET, toda vez que ultrapassar 10% de aumento.',
  impostos:{icms:true,icms_val:'17',ipi:false,ipi_val:'',pis:true,pis_val:'0.65',cofins:true,cofins_val:'3.00',iss:false,iss_val:'',ncm:'73089010',cod_servico:''},
  pagamento:'30 DDL, após a emissão da Notas Fiscal.',pagamento_personalizado:'',
  validade_texto:'30 (Trinta) dias.',
  prazo_entrega:'Em até 20 dias úteis após recebimento do pedido oficial.',
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

// ─── texto da carta conforme tipo de fornecimento ─────────────────────────────
function textoCarta(tipo) {
  const t = (tipo||'').toLowerCase()
  if (t.includes('montagem') && t.includes('fabricação'))
    return 'Encaminhamos nossa proposta comercial para o fornecimento, fabricação, montagem e instalação conforme descrito no Item 1 desta proposta. As especificações técnicas apresentadas estão em plena conformidade com os documentos previamente encaminhados.'
  if (t.includes('montagem') || t.includes('instalação'))
    return 'Encaminhamos nossa proposta comercial para a montagem e instalação conforme descrito no Item 1 desta proposta. As especificações técnicas apresentadas estão em plena conformidade com os documentos previamente encaminhados.'
  return 'Encaminhamos nossa proposta comercial para o fornecimento e fabricação conforme descrito no Item 1 desta proposta. As especificações técnicas apresentadas estão em plena conformidade com os documentos previamente encaminhados.'
}

// ─── PDF/DOC content generator ────────────────────────────────────────────────
function gerarHTML(form) {
  const totalGeral = (form.itens||[]).reduce((s,it)=>s+(Number(it.qtd)||0)*(Number(it.valor)||0),0)

  const itensHTML = (form.itens||[]).map((it,i)=>`
    <tr style="background:${i%2===0?'#fff':'#f9f9f9'}">
      <td style="padding:7px 10px;border:1px solid #ddd;text-align:center;font-size:12px">${i+1}</td>
      <td style="padding:7px 10px;border:1px solid #ddd;font-size:12px">${it.descricao||''}</td>
      <td style="padding:7px 10px;border:1px solid #ddd;text-align:center;font-size:12px">${it.un||''}</td>
      <td style="padding:7px 10px;border:1px solid #ddd;text-align:center;font-size:12px">${it.qtd||''}</td>
      <td style="padding:7px 10px;border:1px solid #ddd;text-align:right;font-size:12px">${Number(it.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
      <td style="padding:7px 10px;border:1px solid #ddd;text-align:right;font-size:12px;font-weight:bold">${((Number(it.qtd)||0)*(Number(it.valor)||0)).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
    </tr>`).join('')

  const secao = (titulo, conteudo) => !conteudo?.trim() ? '' : `
    <div style="margin-bottom:14px;page-break-inside:avoid">
      <h3 style="color:#1565c0;font-size:11px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid #e0e0e0;padding-bottom:5px;margin:0 0 7px">${titulo}</h3>
      <p style="font-size:12px;line-height:1.65;margin:0;white-space:pre-line;color:#333">${conteudo}</p>
    </div>`

  // secao com itens em tópicos (bullet points)
  const secaoLista = (titulo, conteudo) => {
    if (!conteudo?.trim()) return ''
    const itens = conteudo.split('\n').map(l=>l.trim()).filter(Boolean)
    const lis = itens.map(it => `<li style="font-size:12px;line-height:1.7;color:#333;margin-bottom:3px">${it}</li>`).join('')
    return `
    <div style="margin-bottom:14px;page-break-inside:avoid">
      <h3 style="color:#1565c0;font-size:11px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid #e0e0e0;padding-bottom:5px;margin:0 0 7px">${titulo}</h3>
      <ul style="margin:0;padding-left:18px;list-style-type:disc">${lis}</ul>
    </div>`
  }

  const pagamento = form.pagamento==='OUTRO' ? form.pagamento_personalizado : form.pagamento
  const impostosText = typeof form.impostos==='string' ? form.impostos
    : (() => {
        const imp=form.impostos||{}; const parts=[]
        if(imp.icms)   parts.push(`• ICMS: ${imp.icms_val}%`)
        if(imp.ipi)    parts.push(`• IPI: ${imp.ipi_val}%`)
        if(imp.pis)    parts.push(`• PIS: ${imp.pis_val}% (Incluso)`)
        if(imp.cofins) parts.push(`• COFINS: ${imp.cofins_val}% (Incluso)`)
        if(imp.iss)    parts.push(`• ISS: ${imp.iss_val}`)
        if(imp.ncm)    parts.push(`• NCM: ${imp.ncm}`)
        if(imp.cod_servico) parts.push(`• Cód. Serviço: ${imp.cod_servico}`)
        return parts.join('\n')
      })()

  // ── PÁGINA 1: Carta de apresentação ──────────────────────────────────────────
  const pag1 = `
    <div style="page-break-after:always;min-height:100vh;display:flex;flex-direction:column;font-family:Arial,sans-serif;padding:0">

      <!-- cabeçalho com logo e endereço -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 30px 12px;border-bottom:3px solid #1565c0;margin-bottom:0">
        <img src="https://carbat.com.br/wp-content/uploads/2024/06/Carbat-logo-sem-fundo--e1746032537163.png"
          style="height:48px;object-fit:contain">
        <div style="text-align:right;font-size:10px;color:#555;line-height:1.6">
          BR-262, km 11,5, s/n – Três Lagoas/MS<br>
          (67) 3522-2400 | carbat@carbat.com.br
        </div>
      </div>

      <!-- dados da proposta -->
      <div style="padding:30px 30px 0">
        <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
          <tr><td style="font-size:12px;font-weight:bold;width:160px;padding:5px 0;color:#333">CONTRATANTE:</td>
              <td style="font-size:12px;padding:5px 0;color:#333">${form.cliente_nome||''}</td></tr>
          <tr><td style="font-size:12px;font-weight:bold;padding:5px 0;color:#333">A/C:</td>
              <td style="font-size:12px;padding:5px 0;color:#333">${form.contato||''}</td></tr>
          <tr><td style="font-size:12px;font-weight:bold;padding:5px 0;color:#333">REFERÊNCIA:</td>
              <td style="font-size:12px;padding:5px 0;color:#333">${form.referencia||''}</td></tr>
          <tr><td style="font-size:12px;font-weight:bold;padding:5px 0;color:#333">DATA:</td>
              <td style="font-size:12px;padding:5px 0;color:#333">${fmtDateDisplay(form.data_proposta)}</td></tr>
          <tr><td style="font-size:12px;font-weight:bold;padding:5px 0;color:#333">Nº DA PROPOSTA:</td>
              <td style="font-size:12px;padding:5px 0;color:#333">${form.numero||''}</td></tr>
        </table>

        <!-- corpo da carta -->
        <p style="font-size:12px;line-height:1.7;margin-bottom:16px;color:#333">Prezado Sr(a).,</p>
        <p style="font-size:12px;line-height:1.7;margin-bottom:16px;color:#333;text-align:justify">
          ${textoCarta(form.tipo_fornecimento)}
        </p>
        <p style="font-size:12px;line-height:1.7;margin-bottom:16px;color:#333;text-align:justify">
          A CARBAT reafirma seu compromisso em atender às expectativas de seus clientes, assegurando a entrega de produtos e serviços com qualidade e dentro dos prazos estabelecidos.
        </p>
        <p style="font-size:12px;line-height:1.7;margin-bottom:40px;color:#333;text-align:justify">
          Agradecemos a oportunidade de participação e permanecemos à disposição para quaisquer esclarecimentos adicionais que se façam necessários.
        </p>

        <p style="font-size:12px;margin-bottom:4px;color:#333">Atenciosamente,</p>
        <p style="font-size:12px;font-weight:bold;margin-bottom:60px;color:#333">CARBAT DO BRASIL</p>

        <!-- assinaturas -->
        <div style="display:flex;gap:60px;margin-top:20px">
          <div style="font-size:11px;color:#333;line-height:1.7">
            <p style="margin:0;font-weight:bold">Eng.ª Camila Barcellos Gomes</p>
            <p style="margin:0">camila@carbat.com.br</p>
            <p style="margin:0">(71) 9 3387-4051</p>
          </div>
          <div style="font-size:11px;color:#333;line-height:1.7">
            <p style="margin:0;font-weight:bold">Diretor Renato Gomes Filho</p>
            <p style="margin:0">renato@carbat.com.br</p>
            <p style="margin:0">(67) 9 9244-7793</p>
          </div>
        </div>
      </div>

      <!-- marca d'água CARBAT -->
      <div style="position:fixed;bottom:80px;right:40px;font-size:72px;font-weight:900;color:rgba(21,101,192,0.07);transform:rotate(-30deg);pointer-events:none;letter-spacing:-2px">
        CARBAT
      </div>
    </div>`

  // ── PÁGINAS SEGUINTES: Conteúdo técnico ───────────────────────────────────────
  const pag2 = `
    <div style="font-family:Arial,sans-serif;padding:30px;color:#333">

      <!-- mini header em todas as páginas -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;border-bottom:2px solid #1565c0;margin-bottom:20px">
        <img src="https://carbat.com.br/wp-content/uploads/2024/06/Carbat-logo-sem-fundo--e1746032537163.png" style="height:32px;object-fit:contain">
        <span style="font-size:10px;color:#888">Proposta ${form.numero||''} — Rev. ${form.revisao||''} | ${fmtDateDisplay(form.data_proposta)}</span>
      </div>

      <!-- tabela de itens -->
      <h2 style="color:#1565c0;font-size:12px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid #e0e0e0;padding-bottom:6px;margin:0 0 10px">1. Itens do Orçamento</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:12px">
        <thead>
          <tr style="background:#1565c0;color:#fff">
            <th style="padding:8px 10px;text-align:center;width:35px">#</th>
            <th style="padding:8px 10px;text-align:left">Descrição de Fabricação</th>
            <th style="padding:8px 10px;width:50px">Un.</th>
            <th style="padding:8px 10px;width:60px">Qtd.</th>
            <th style="padding:8px 10px;width:90px;text-align:right">Unit. R$</th>
            <th style="padding:8px 10px;width:110px;text-align:right">Total R$</th>
          </tr>
        </thead>
        <tbody>${itensHTML}</tbody>
      </table>
      <div style="text-align:right;background:#e3f2fd;color:#0d47a1;padding:10px 14px;border-radius:5px;font-size:13px;font-weight:bold;margin-bottom:24px">
        TOTAL GERAL: R$ ${totalGeral.toLocaleString('pt-BR',{minimumFractionDigits:2})}
      </div>

      ${form.observacoes?secao('Observações Gerais',form.observacoes):''}
      ${secao('Condições de Pagamento', pagamento)}
      ${secao('Validade da Proposta', form.validade_texto)}
      ${secao('Prazo de Entrega', form.prazo_entrega)}
      ${secao('Reajuste', form.reajuste)}
      ${secao('Tributos e Encargos Fiscais', impostosText)}
      ${secao('Garantia', form.garantia)}
      ${secaoLista('Escopo de Fornecimento', arrToText([...(form.escopo||[]),...(form.escopo_extra||[])]))}
      ${secaoLista('Fora de Escopo / Escopo Contratante', arrToText([...(form.fora_escopo||[]),...(form.fora_escopo_extra||[])]))}
      ${secao('Ensaios Não Destrutivos', form.ensaios)}
      ${secaoLista('Tratamento Anticorrosivo', arrToText([...(form.tratamento||[]),...(form.tratamento_extra||[])]))}
      ${secaoLista('Data Book Técnico', arrToText([...(form.databook||[]),...(form.databook_extra||[])]))}
      ${secao('Condições de Transporte e Logística', (form.transporte_tipo||'')+(form.transporte_local?'\nLocal: '+form.transporte_local:''))}
      ${secaoLista('Documentos de Referência Recebidos',
        arrToText(form.documentos||[])+(form.documentos_enviado_por?`\n\nEnviados por ${form.documentos_enviado_por}, no dia ${fmtDateDisplay(form.documentos_data)}.`:'')
      )}
    </div>`

  return pag1 + pag2
}

function gerarPDF(form) {
  const nome = buildFilename(form)
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${nome}</title>
    <style>
      @page { margin: 15mm 15mm 15mm 15mm; }
      body { margin:0; padding:0; }
      @media print { .no-print { display:none; } }
    </style>
    </head><body>
    ${gerarHTML(form)}
    <script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script>
    </body></html>`
  const w = window.open('','_blank')
  w.document.write(html); w.document.close()
}

function gerarDOC(form) {
  const nome = buildFilename(form)
  // Gera o HTML e força tamanho fixo nas imagens via substituição de string
  let conteudo = gerarHTML(form)
  // Adiciona width fixo em todas as tags <img>
  conteudo = conteudo.replace(/<img([^>]*)>/gi, (m, attrs) => {
    // Remove width/height existentes e injeta os corretos
    const cleaned = attrs.replace(/width="[^"]*"/gi,'').replace(/height="[^"]*"/gi,'')
      .replace(/style="([^"]*)"/gi, (sm, s) =>
        `style="${s.replace(/width:[^;]*/gi,'').replace(/height:[^;]*/gi,'')};width:130px;height:auto"`)
    // Se não tinha style, adiciona
    if (!/style=/i.test(cleaned)) return `<img${cleaned} style="width:130px;height:auto">`
    return `<img${cleaned}>`
  })

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:w="urn:schemas-microsoft-com:office:word"
    xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <title>${nome}</title>
      <!--[if gte mso 9]><xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
        <o:OfficeDocumentSettings><o:AllowPNG/></o:OfficeDocumentSettings>
      </xml><![endif]-->
      <style>
        @page Section1 {
          size: 21.0cm 29.7cm;
          margin: 1.5cm 1.5cm 1.5cm 1.5cm;
          mso-header-margin: 0.5cm;
          mso-footer-margin: 0.5cm;
        }
        div.Section1 { page: Section1; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #333; margin: 0; padding: 0; }
        img { width: 130px !important; height: auto !important; max-width: 130px !important; display: block; }
        table { border-collapse: collapse; width: 100%; }
        td, th { font-size: 12px; }
        p { margin: 0 0 8px 0; }
      </style>
    </head>
    <body><div class="Section1">${conteudo}</div></body>
    </html>`

  const blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = nome + '.doc'; a.click()
  URL.revokeObjectURL(url)
}

// ─── sub-components ───────────────────────────────────────────────────────────
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
          <input type="checkbox" className="mt-0.5 accent-blue-600"
            checked={selected.includes(opt)} onChange={()=>onToggle(opt)} />
          <span className="text-slate-700">{opt}</span>
        </label>
      ))}
      {extras.map((val,i)=>(
        <div key={i} className="flex gap-2 items-center mt-1">
          <input className={inp} value={val} placeholder="Digite um item adicional..."
            onChange={e=>onChangeExtra(i,e.target.value)} />
          <button type="button" onClick={()=>onRemoveExtra(i)}
            className="text-red-500 hover:text-red-700 p-1 flex-shrink-0"><X size={14}/></button>
        </div>
      ))}
      <button type="button" onClick={onAddExtra}
        className="mt-2 text-xs bg-slate-500 text-white px-3 py-1.5 rounded hover:bg-slate-600 w-fit">
        + Adicionar Item
      </button>
    </div>
  )
}

// ─── modal (sem botões de exportar) ──────────────────────────────────────────
function PropostaModal({ modal, clientes, onClose, onSaved }) {
  const [form, setForm]   = useState(modal.form)
  const [saving, setSaving] = useState(false)
  const isEdit = modal.mode === 'edit'

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

        {/* header */}
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
          {/* Cabeçalho */}
          <Section title="Cabeçalho da Proposta">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Contratante">
                <input className={inp} value={form.cliente_nome} onChange={e=>set('cliente_nome',e.target.value)} list="cl-list" placeholder="Ex: Brasil ao Cubo"/>
                <datalist id="cl-list">{clientes.map(c=><option key={c.id} value={c.razao_social}/>)}</datalist>
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
                <input className={inp} value={form.numero} onChange={e=>set('numero',e.target.value)} placeholder="260000"/>
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

          {/* Itens */}
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
                  {form.itens.length===0&&(
                    <tr><td colSpan={7} className="py-8 text-center text-slate-400 text-sm italic">Clique em "+ Adicionar Novo Item" para começar</td></tr>
                  )}
                  {form.itens.map((it,i)=>(
                    <tr key={i} className={`border-t border-slate-100 ${i%2===0?'bg-white':'bg-slate-50'}`}>
                      <td className="px-3 py-2 text-center text-slate-400 text-xs">{i+1}</td>
                      <td className="px-2 py-1">
                        <textarea className="w-full text-sm resize-none border-0 outline-none bg-transparent min-h-[36px] p-1"
                          rows={1} value={it.descricao} placeholder="Descrição do item" onChange={e=>setItem(i,'descricao',e.target.value)}/>
                      </td>
                      <td className="px-2 py-1"><input className="w-full text-sm border-0 outline-none bg-transparent text-center" value={it.un} onChange={e=>setItem(i,'un',e.target.value)}/></td>
                      <td className="px-2 py-1"><input type="number" className="w-full text-sm border-0 outline-none bg-transparent text-center" value={it.qtd} min={1} onChange={e=>setItem(i,'qtd',e.target.value)}/></td>
                      <td className="px-2 py-1"><input type="number" className="w-full text-sm border-0 outline-none bg-transparent text-right" value={it.valor} step="0.01" min={0} onChange={e=>setItem(i,'valor',e.target.value)}/></td>
                      <td className="px-3 py-1 font-bold text-slate-700 text-right text-sm">{((Number(it.qtd)||0)*(Number(it.valor)||0)).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                      <td className="px-2 py-1 text-center">
                        <button type="button" onClick={()=>removeItem(i)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"><X size={14}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-3">
              <button type="button" onClick={addItem} className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors">+ Adicionar Novo Item</button>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-5 py-2.5 font-bold text-blue-900 text-base">
                TOTAL GERAL:&nbsp;{totalGeral.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
              </div>
            </div>
          </Section>

          {/* Observações */}
          <Section title="Observações Gerais" defaultOpen={false}>
            <textarea className={`${inp} min-h-[80px]`} rows={3} value={form.observacoes} onChange={e=>set('observacoes',e.target.value)} placeholder="Descreva observações técnicas ou comerciais adicionais..."/>
            <p className="text-xs text-slate-400 italic mt-1">*Se deixado em branco, não aparecerá na proposta final.</p>
          </Section>

          {/* Condições Gerais */}
          <Section title="Condições Gerais e Escopo" defaultOpen={false}>
            <div className="space-y-5">
              <Field label="Reajuste">
                <textarea className={`${inp} min-h-[55px]`} rows={2} value={form.reajuste} onChange={e=>set('reajuste',e.target.value)}/>
              </Field>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Tributos e Encargos Fiscais</label>
                <div className="grid grid-cols-2 gap-3 bg-blue-50 p-4 rounded-lg border border-blue-200">
                  {[{chk:'icms',val:'icms_val',label:'ICMS (%)'},{chk:'ipi',val:'ipi_val',label:'IPI (%)'},{chk:'pis',val:'pis_val',label:'PIS (%)'},{chk:'cofins',val:'cofins_val',label:'COFINS (%)'},{chk:'iss',val:'iss_val',label:'ISS (%)'}].map(({chk,val,label})=>(
                    <div key={chk} className="bg-white rounded-lg p-3 border border-slate-200 flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" className="accent-blue-600" checked={!!form.impostos[chk]} onChange={e=>setImp(chk,e.target.checked)}/>
                        <span className="font-medium text-slate-700">{label}</span>
                      </label>
                      <input className={inp} value={form.impostos[val]} onChange={e=>setImp(val,e.target.value)} placeholder="0"/>
                    </div>
                  ))}
                  <div className="bg-white rounded-lg p-3 border border-slate-200 flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700">NCM</label>
                    <input className={inp} value={form.impostos.ncm} onChange={e=>setImp('ncm',e.target.value)}/>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-slate-200 flex flex-col gap-2 col-span-2">
                    <label className="text-sm font-medium text-slate-700">Código do Serviço</label>
                    <input className={inp} value={form.impostos.cod_servico} onChange={e=>setImp('cod_servico',e.target.value)} placeholder="Ex: 14.01"/>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Condições de Pagamento">
                  <select className={sel} value={form.pagamento} onChange={e=>set('pagamento',e.target.value)}>
                    {PAGAMENTO_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {form.pagamento==='OUTRO'&&(
                    <input className={`${inp} mt-2`} value={form.pagamento_personalizado} onChange={e=>set('pagamento_personalizado',e.target.value)} placeholder="Descreva a condição de pagamento"/>
                  )}
                </Field>
                <Field label="Validade da Proposta Comercial">
                  <input className={inp} value={form.validade_texto} onChange={e=>set('validade_texto',e.target.value)}/>
                </Field>
                <Field label="Prazo de Entrega e Capacidade Produtiva" full>
                  <input className={inp} value={form.prazo_entrega} onChange={e=>set('prazo_entrega',e.target.value)}/>
                </Field>
              </div>

              <Field label="Garantia">
                <textarea className={`${inp} min-h-[90px]`} rows={4} value={form.garantia} onChange={e=>set('garantia',e.target.value)}/>
                <p className="text-xs text-slate-400 italic mt-1">*Se deixado em branco, não aparecerá na proposta final.</p>
              </Field>
              <Field label="Escopo de Fornecimento">
                <CheckGroup options={ESCOPO_OPTS} selected={form.escopo} onToggle={v=>toggleCheck('escopo',v)}
                  extras={form.escopo_extra} onAddExtra={()=>addExtra('escopo_extra')}
                  onRemoveExtra={i=>removeExtra('escopo_extra',i)} onChangeExtra={(i,v)=>changeExtra('escopo_extra',i,v)}/>
              </Field>
              <Field label="Fora de Escopo / Escopo Contratante">
                <CheckGroup options={FORA_ESCOPO_OPTS} selected={form.fora_escopo} onToggle={v=>toggleCheck('fora_escopo',v)}
                  extras={form.fora_escopo_extra} onAddExtra={()=>addExtra('fora_escopo_extra')}
                  onRemoveExtra={i=>removeExtra('fora_escopo_extra',i)} onChangeExtra={(i,v)=>changeExtra('fora_escopo_extra',i,v)}/>
              </Field>
              <Field label="Ensaios Não Destrutivos">
                <input className={inp} value={form.ensaios} onChange={e=>set('ensaios',e.target.value)}/>
              </Field>
              <Field label="Tratamento Anticorrosivo">
                <CheckGroup options={TRATAMENTO_OPTS} selected={form.tratamento} onToggle={v=>toggleCheck('tratamento',v)}
                  extras={form.tratamento_extra} onAddExtra={()=>addExtra('tratamento_extra')}
                  onRemoveExtra={i=>removeExtra('tratamento_extra',i)} onChangeExtra={(i,v)=>changeExtra('tratamento_extra',i,v)}/>
              </Field>
              <Field label="Data Book Técnico">
                <CheckGroup options={DATABOOK_OPTS} selected={form.databook} onToggle={v=>toggleCheck('databook',v)}
                  extras={form.databook_extra} onAddExtra={()=>addExtra('databook_extra')}
                  onRemoveExtra={i=>removeExtra('databook_extra',i)} onChangeExtra={(i,v)=>changeExtra('databook_extra',i,v)}/>
              </Field>
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
                  <div className="space-y-2">
                    {form.documentos.map((doc,i)=>(
                      <div key={i} className="flex gap-2 items-center">
                        <input className={inp} value={doc} onChange={e=>setDoc(i,e.target.value)} placeholder="Ex: Projeto Executivo Rev.02"/>
                        <button type="button" onClick={()=>removeDoc(i)} className="text-red-500 hover:text-red-700 p-1 flex-shrink-0"><X size={14}/></button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addDoc} className="mt-3 text-xs bg-slate-500 text-white px-3 py-1.5 rounded hover:bg-slate-600">+ Adicionar Documento</button>
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200 mt-4">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Enviado por:</label>
                      <input className={inp} value={form.documentos_enviado_por} onChange={e=>set('documentos_enviado_por',e.target.value)} placeholder="Ex: contato@empresa.com"/>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Data de Recebimento:</label>
                      <input type="date" className={inp} value={form.documentos_data} onChange={e=>set('documentos_data',e.target.value)}/>
                    </div>
                  </div>
                </div>
              </Field>
            </div>
          </Section>
        </div>

        {/* footer — somente salvar */}
        <div className="flex justify-end gap-3 p-5 border-t bg-slate-50 rounded-b-2xl sticky bottom-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors">Cancelar</button>
          <button type="button" onClick={save} disabled={saving}
            className="px-6 py-2 text-sm rounded-lg bg-blue-700 text-white font-bold hover:bg-blue-800 disabled:opacity-50 transition-colors uppercase tracking-wide">
            {saving?'Salvando...':isEdit?`Salvar (Rev. ${nextRev})`:'Criar Proposta'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────
export default function PropostasPage() {
  const [propostas, setPropostas] = useState([])
  const [clientes,  setClientes]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [modal,     setModal]     = useState(null)

  const load = async () => {
    const [p,c] = await Promise.all([api.propostas.list(), api.clientes.list()])
    setPropostas(p); setClientes(c); setLoading(false)
  }
  useEffect(()=>{ load() },[])

  const openNew  = () => setModal({ mode:'new', form:{ ...EMPTY_FORM, data_proposta:new Date().toISOString().split('T')[0] } })
  const openEdit = (p) => setModal({ mode:'edit', id:p.id, form:buildForm(p) })
  const close    = () => setModal(null)
  const del = async (id) => {
    if (!confirm('Excluir esta proposta?')) return
    await api.propostas.delete(id); load()
  }

  const filtered = propostas.filter(p=>
    (p.titulo+p.cliente_nome+p.numero+p.status).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8">
      <PageHeader
        title="Propostas Comerciais"
        subtitle={`${propostas.length} proposta${propostas.length!==1?'s':''}`}
        action={
          <button onClick={openNew} className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-800 transition-colors">
            <Plus size={16}/> Nova Proposta
          </button>
        }
      />

      <Card>
        <div className="p-4 border-b flex items-center gap-3">
          <Search size={16} className="text-slate-400"/>
          <input className="flex-1 text-sm outline-none bg-transparent"
            placeholder="Buscar por título, cliente, número ou status..."
            value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>

        {loading ? <Spinner/> : (
          <Table
            headers={['Número / Rev.','Título','Cliente','Valor Total','Status','Data','']}
            empty={filtered.length===0?'Nenhuma proposta encontrada':''}
          >
            {filtered.map(p=>(
              <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4 text-xs font-mono text-slate-600">
                  {p.numero||'—'}<span className="ml-1 text-slate-400">Rev.{p.revisao}</span>
                </td>
                <td className="py-3 px-4 font-medium text-slate-800 max-w-xs truncate">{p.titulo}</td>
                <td className="py-3 px-4 text-slate-600 text-sm">{p.cliente_nome||'—'}</td>
                <td className="py-3 px-4 text-sm font-semibold text-slate-700">{fmt(p.valor_total)}</td>
                <td className="py-3 px-4"><Badge color={STATUS_COLOR[p.status]||'gray'}>{p.status}</Badge></td>
                <td className="py-3 px-4 text-slate-600 text-xs">{fmtDateDisplay(p.data_proposta)}</td>
                <td className="py-3 px-4">
                  <div className="flex gap-1 justify-end items-center">
                    {/* PDF */}
                    <button onClick={()=>gerarPDF(buildForm(p))}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="Gerar PDF">
                      <FileText size={14}/>
                    </button>
                    {/* DOC */}
                    <button onClick={()=>gerarDOC(buildForm(p))}
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-700 transition-colors" title="Gerar .DOC">
                      <FileDown size={14}/>
                    </button>
                    {/* Editar */}
                    <button onClick={()=>openEdit(p)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors" title="Editar">
                      <Pencil size={14}/>
                    </button>
                    {/* Excluir */}
                    <button onClick={()=>del(p.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors" title="Excluir">
                      <Trash2 size={14}/>
                    </button>
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
