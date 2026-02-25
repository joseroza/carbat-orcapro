/**
 * gerarProposta.js
 * Utilitário de exportação de Propostas Comerciais da Carbat.
 *
 * Exporta:
 *   gerarPDF(form)   → abre janela de impressão/PDF no navegador
 *   gerarDOCX(form)  → baixa arquivo .docx usando a lib `docx`
 *
 * Dependência (adicionar ao package.json do frontend):
 *   npm install docx
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, AlignmentType, WidthType, BorderStyle, ShadingType,
  VerticalAlign, PageBreak, LevelFormat, UnderlineType,
} from 'docx'

// ─── helpers compartilhados ───────────────────────────────────────────────────

export function parseDate(val) {
  if (!val) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  if (val.includes('T')) return val.split('T')[0]
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) { const [d,m,y]=val.split('/'); return `${y}-${m}-${d}` }
  return ''
}

export function fmtDateDisplay(val) {
  const d = parseDate(val); if (!d) return '—'
  const [y,m,day] = d.split('-'); return `${day}/${m}/${y}`
}

export function arrToText(arr) {
  return (arr||[]).filter(Boolean).join('\n')
}

export function buildFilename(form) {
  const clean = (s) => (s||'').replace(/[/\\?%*:|"<>\s]/g,'_').replace(/_+/g,'_')
  return [clean(form.numero),clean(form.cliente_nome),clean(form.titulo),clean(form.referencia),'Rev'+clean(form.revisao)].filter(Boolean).join('_')
}

export function textoCarta(tipo) {
  const t = (tipo||'').toLowerCase()
  if (t.includes('montagem') && t.includes('fabricação'))
    return 'Encaminhamos nossa proposta comercial para o fornecimento, fabricação, montagem e instalação conforme descrito no Item 1 desta proposta. As especificações técnicas apresentadas estão em plena conformidade com os documentos previamente encaminhados.'
  if (t.includes('montagem') || t.includes('instalação'))
    return 'Encaminhamos nossa proposta comercial para a montagem e instalação conforme descrito no Item 1 desta proposta. As especificações técnicas apresentadas estão em plena conformidade com os documentos previamente encaminhados.'
  return 'Encaminhamos nossa proposta comercial para o fornecimento e fabricação conforme descrito no Item 1 desta proposta. As especificações técnicas apresentadas estão em plena conformidade com os documentos previamente encaminhados.'
}

export function impostosToText(impostos) {
  if (typeof impostos === 'string') return impostos
  const imp = impostos || {}
  const parts = []
  if (imp.icms)        parts.push(`ICMS: ${imp.icms_val}%`)
  if (imp.ipi)         parts.push(`IPI: ${imp.ipi_val}%`)
  if (imp.pis)         parts.push(`PIS: ${imp.pis_val}% (Incluso)`)
  if (imp.cofins)      parts.push(`COFINS: ${imp.cofins_val}% (Incluso)`)
  if (imp.iss)         parts.push(`ISS: ${imp.iss_val}`)
  if (imp.ncm)         parts.push(`NCM: ${imp.ncm}`)
  if (imp.cod_servico) parts.push(`Cód. Serviço: ${imp.cod_servico}`)
  return parts.join('\n')
}

// ─── PDF (HTML → print dialog) ───────────────────────────────────────────────

function _htmlSecao(titulo, conteudo) {
  if (!conteudo?.trim()) return ''
  return `
    <div style="margin-bottom:14px;page-break-inside:avoid">
      <h3 style="color:#1565c0;font-size:11px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid #e0e0e0;padding-bottom:5px;margin:0 0 7px">${titulo}</h3>
      <p style="font-size:12px;line-height:1.65;margin:0;white-space:pre-line;color:#333">${conteudo}</p>
    </div>`
}

function _htmlSecaoLista(titulo, conteudo) {
  if (!conteudo?.trim()) return ''
  const lis = conteudo.split('\n').map(l=>l.trim()).filter(Boolean)
    .map(it=>`<li style="font-size:12px;line-height:1.7;color:#333;margin-bottom:3px">${it}</li>`).join('')
  return `
    <div style="margin-bottom:14px;page-break-inside:avoid">
      <h3 style="color:#1565c0;font-size:11px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid #e0e0e0;padding-bottom:5px;margin:0 0 7px">${titulo}</h3>
      <ul style="margin:0;padding-left:18px;list-style-type:disc">${lis}</ul>
    </div>`
}

function _gerarHTMLProposta(form) {
  const totalGeral = (form.itens||[]).reduce((s,it)=>s+(Number(it.qtd)||0)*(Number(it.valor)||0),0)
  const pagamento  = form.pagamento==='OUTRO' ? form.pagamento_personalizado : form.pagamento
  const impostos   = impostosToText(form.impostos)

  const itensRows = (form.itens||[]).map((it,i)=>`
    <tr style="background:${i%2===0?'#fff':'#f9f9f9'}">
      <td style="padding:7px 10px;border:1px solid #ddd;text-align:center;font-size:12px">${i+1}</td>
      <td style="padding:7px 10px;border:1px solid #ddd;font-size:12px">${it.descricao||''}</td>
      <td style="padding:7px 10px;border:1px solid #ddd;text-align:center;font-size:12px">${it.un||''}</td>
      <td style="padding:7px 10px;border:1px solid #ddd;text-align:center;font-size:12px">${it.qtd||''}</td>
      <td style="padding:7px 10px;border:1px solid #ddd;text-align:right;font-size:12px">${Number(it.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
      <td style="padding:7px 10px;border:1px solid #ddd;text-align:right;font-size:12px;font-weight:bold">${((Number(it.qtd)||0)*(Number(it.valor)||0)).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
    </tr>`).join('')

  const LOGO = `https://carbat.com.br/wp-content/uploads/2024/06/Carbat-logo-sem-fundo--e1746032537163.png`

  const pag1 = `
    <div style="page-break-after:always;font-family:Arial,sans-serif;padding:30px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:3px solid #1565c0;margin-bottom:24px">
        <img src="${LOGO}" style="height:48px;object-fit:contain">
        <div style="text-align:right;font-size:10px;color:#555;line-height:1.6">
          BR-262, km 11,5, s/n – Três Lagoas/MS<br>(67) 3522-2400 | carbat@carbat.com.br
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
        <tr><td style="font-size:12px;font-weight:bold;width:160px;padding:5px 0">CONTRATANTE:</td><td style="font-size:12px;padding:5px 0">${form.cliente_nome||''}</td></tr>
        <tr><td style="font-size:12px;font-weight:bold;padding:5px 0">A/C:</td><td style="font-size:12px;padding:5px 0">${form.contato||''}</td></tr>
        <tr><td style="font-size:12px;font-weight:bold;padding:5px 0">REFERÊNCIA:</td><td style="font-size:12px;padding:5px 0">${form.referencia||''}</td></tr>
        <tr><td style="font-size:12px;font-weight:bold;padding:5px 0">DATA:</td><td style="font-size:12px;padding:5px 0">${fmtDateDisplay(form.data_proposta)}</td></tr>
        <tr><td style="font-size:12px;font-weight:bold;padding:5px 0">Nº DA PROPOSTA:</td><td style="font-size:12px;padding:5px 0">${form.numero||''}</td></tr>
      </table>
      <p style="font-size:12px;line-height:1.7;margin-bottom:16px">Prezado Sr(a).,</p>
      <p style="font-size:12px;line-height:1.7;margin-bottom:16px;text-align:justify">${textoCarta(form.tipo_fornecimento)}</p>
      <p style="font-size:12px;line-height:1.7;margin-bottom:16px;text-align:justify">A CARBAT reafirma seu compromisso em atender às expectativas de seus clientes, assegurando a entrega de produtos e serviços com qualidade e dentro dos prazos estabelecidos.</p>
      <p style="font-size:12px;line-height:1.7;margin-bottom:40px;text-align:justify">Agradecemos a oportunidade de participação e permanecemos à disposição para quaisquer esclarecimentos adicionais que se façam necessários.</p>
      <p style="font-size:12px;margin-bottom:4px">Atenciosamente,</p>
      <p style="font-size:12px;font-weight:bold;margin-bottom:60px">CARBAT DO BRASIL</p>
      <div style="display:flex;gap:60px">
        <div style="font-size:11px;line-height:1.7"><p style="margin:0;font-weight:bold">Eng.ª Camila Barcellos Gomes</p><p style="margin:0">camila@carbat.com.br</p><p style="margin:0">(71) 9 3387-4051</p></div>
        <div style="font-size:11px;line-height:1.7"><p style="margin:0;font-weight:bold">Diretor Renato Gomes Filho</p><p style="margin:0">renato@carbat.com.br</p><p style="margin:0">(67) 9 9244-7793</p></div>
      </div>
      <div style="position:fixed;bottom:80px;right:40px;font-size:72px;font-weight:900;color:rgba(21,101,192,0.07);transform:rotate(-30deg);pointer-events:none">CARBAT</div>
    </div>`

  const pag2 = `
    <div style="font-family:Arial,sans-serif;padding:30px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;border-bottom:2px solid #1565c0;margin-bottom:20px">
        <img src="${LOGO}" style="height:32px;object-fit:contain">
        <span style="font-size:10px;color:#888">Proposta ${form.numero||''} — Rev. ${form.revisao||''} | ${fmtDateDisplay(form.data_proposta)}</span>
      </div>
      <h2 style="color:#1565c0;font-size:12px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid #e0e0e0;padding-bottom:6px;margin:0 0 10px">1. Itens do Orçamento</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
        <thead>
          <tr style="background:#1565c0;color:#fff">
            <th style="padding:8px 10px;text-align:center;width:35px">#</th>
            <th style="padding:8px 10px;text-align:left">Descrição de Fabricação</th>
            <th style="padding:8px 10px;width:50px;text-align:center">Un.</th>
            <th style="padding:8px 10px;width:60px;text-align:center">Qtd.</th>
            <th style="padding:8px 10px;width:90px;text-align:right">Unit. R$</th>
            <th style="padding:8px 10px;width:110px;text-align:right">Total R$</th>
          </tr>
        </thead>
        <tbody>${itensRows}</tbody>
      </table>
      <div style="text-align:right;background:#e3f2fd;color:#0d47a1;padding:10px 14px;border-radius:5px;font-size:13px;font-weight:bold;margin-bottom:24px">
        TOTAL GERAL: R$ ${totalGeral.toLocaleString('pt-BR',{minimumFractionDigits:2})}
      </div>
      ${form.observacoes ? _htmlSecao('Observações Gerais', form.observacoes) : ''}
      ${_htmlSecao('Condições de Pagamento', pagamento)}
      ${_htmlSecao('Validade da Proposta', form.validade_texto)}
      ${_htmlSecao('Prazo de Entrega', form.prazo_entrega)}
      ${_htmlSecao('Reajuste', form.reajuste)}
      ${_htmlSecao('Tributos e Encargos Fiscais', impostos)}
      ${_htmlSecao('Garantia', form.garantia)}
      ${_htmlSecaoLista('Escopo de Fornecimento', arrToText([...(form.escopo||[]),...(form.escopo_extra||[])]))}
      ${_htmlSecaoLista('Fora de Escopo / Escopo Contratante', arrToText([...(form.fora_escopo||[]),...(form.fora_escopo_extra||[])]))}
      ${_htmlSecao('Ensaios Não Destrutivos', form.ensaios)}
      ${_htmlSecaoLista('Tratamento Anticorrosivo', arrToText([...(form.tratamento||[]),...(form.tratamento_extra||[])]))}
      ${_htmlSecaoLista('Data Book Técnico', arrToText([...(form.databook||[]),...(form.databook_extra||[])]))}
      ${_htmlSecao('Condições de Transporte e Logística', (form.transporte_tipo||'')+(form.transporte_local?'\nLocal: '+form.transporte_local:''))}
      ${_htmlSecaoLista('Documentos de Referência Recebidos',
        arrToText(form.documentos||[])+(form.documentos_enviado_por?`\n\nEnviados por ${form.documentos_enviado_por}, no dia ${fmtDateDisplay(form.documentos_data)}.`:'')
      )}
    </div>`

  return pag1 + pag2
}

export function gerarPDF(form) {
  const nome = buildFilename(form)
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${nome}</title>
    <style>@page{margin:15mm} body{margin:0;padding:0} @media print{.no-print{display:none}}</style>
    </head><body>${_gerarHTMLProposta(form)}
    <script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script></body></html>`
  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
}

// ─── DOCX ─────────────────────────────────────────────────────────────────────

// Constantes de layout A4 (em DXA: 1 inch = 1440 DXA)
const A4_W        = 11906  // ~21cm
const A4_H        = 16838  // ~29.7cm
const MARGIN      = 1134   // ~2cm
const CONTENT_W   = A4_W - MARGIN * 2  // ~9638 DXA

const BLUE        = '1565C0'
const LIGHT_BLUE  = 'E3F2FD'
const BLUE_TEXT   = '0D47A1'
const GRAY_LINE   = 'E0E0E0'
const DARK        = '333333'

// Bordas padrão de tabela
const _border  = (color='CCCCCC') => ({ style: BorderStyle.SINGLE, size: 4, color })
const _borders = (color='CCCCCC') => ({ top:_border(color), bottom:_border(color), left:_border(color), right:_border(color) })
const _noBorder = () => ({ style: BorderStyle.NONE, size: 0, color: 'FFFFFF' })
const _noBorders = () => ({ top:_noBorder(), bottom:_noBorder(), left:_noBorder(), right:_noBorder() })

// Parágrafo de texto simples
function _p(text, opts={}) {
  return new Paragraph({
    spacing: { before: opts.spaceBefore||0, after: opts.spaceAfter||80 },
    alignment: opts.align || AlignmentType.LEFT,
    children: [new TextRun({
      text: text||'',
      font: 'Arial',
      size: opts.size || 22,
      bold: opts.bold || false,
      color: opts.color || DARK,
      italics: opts.italic || false,
    })]
  })
}

// Linha separadora azul
function _rule(color=BLUE) {
  return new Paragraph({
    spacing: { before: 0, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color, space: 2 } },
    children: []
  })
}

// Título de seção (ex: "CONDIÇÕES DE PAGAMENTO")
function _sectionTitle(text) {
  return new Paragraph({
    spacing: { before: 200, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GRAY_LINE, space: 2 } },
    children: [new TextRun({ text: text.toUpperCase(), font:'Arial', size:18, bold:true, color:BLUE })]
  })
}

// Bloco de seção com título + texto (retorna array de Paragraph)
function _secao(titulo, texto) {
  if (!texto?.trim()) return []
  const linhas = texto.split('\n').map(l => _p(l.trim(), { size:20, color:DARK }))
  return [_sectionTitle(titulo), ...linhas]
}

// Bloco de seção com lista bullet
function _secaoLista(titulo, texto) {
  if (!texto?.trim()) return []
  const itens = texto.split('\n').map(l=>l.trim()).filter(Boolean).map(l =>
    new Paragraph({
      numbering: { reference:'bullets', level:0 },
      spacing: { before: 0, after: 40 },
      children: [new TextRun({ text:l, font:'Arial', size:20, color:DARK })]
    })
  )
  return [_sectionTitle(titulo), ...itens]
}

// Célula de tabela genérica
function _cell(children, opts={}) {
  return new TableCell({
    width: { size: opts.width || 0, type: opts.widthType || WidthType.AUTO },
    columnSpan: opts.colSpan,
    rowSpan:    opts.rowSpan,
    verticalAlign: opts.vAlign || VerticalAlign.CENTER,
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    borders: opts.borders || _borders(),
    margins: { top:60, bottom:60, left:100, right:100 },
    children: Array.isArray(children) ? children : [children],
  })
}

// Célula de cabeçalho de tabela (fundo azul)
function _headerCell(text, width) {
  return _cell(
    new Paragraph({ alignment:AlignmentType.CENTER, spacing:{before:0,after:0},
      children:[new TextRun({text, font:'Arial', size:20, bold:true, color:'FFFFFF'})] }),
    { width, widthType:WidthType.DXA, fill: BLUE, borders: _borders(BLUE) }
  )
}

// ─── fetch logo como ArrayBuffer ─────────────────────────────────────────────
async function _fetchLogo() {
  try {
    const res = await fetch('https://carbat.com.br/wp-content/uploads/2024/06/Carbat-logo-sem-fundo--e1746032537163.png')
    if (!res.ok) return null
    return await res.arrayBuffer()
  } catch { return null }
}

// ─── Função principal ─────────────────────────────────────────────────────────
export async function gerarDOCX(form) {
  const logoBuffer = await _fetchLogo()
  const totalGeral = (form.itens||[]).reduce((s,it)=>s+(Number(it.qtd)||0)*(Number(it.valor)||0),0)
  const pagamento  = form.pagamento==='OUTRO' ? form.pagamento_personalizado : form.pagamento
  const impostos   = impostosToText(form.impostos)

  // Logo ImageRun (se conseguiu baixar)
  const logoRun = logoBuffer
    ? new ImageRun({ data: logoBuffer, transformation:{ width:150, height:40 }, type:'png' })
    : new TextRun({ text:'CARBAT DO BRASIL', font:'Arial', size:28, bold:true, color:BLUE })

  // ── Página 1: Carta ──────────────────────────────────────────────────────────

  // Cabeçalho: logo + endereço lado a lado
  const headerTable = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [Math.round(CONTENT_W*0.5), Math.round(CONTENT_W*0.5)],
    borders: { top:_noBorder(), bottom:{ style:BorderStyle.SINGLE, size:12, color:BLUE }, left:_noBorder(), right:_noBorder(), insideH:_noBorder(), insideV:_noBorder() },
    rows: [new TableRow({ children: [
      _cell(new Paragraph({ children:[logoRun] }), { width:Math.round(CONTENT_W*0.5), widthType:WidthType.DXA, borders:_noBorders() }),
      _cell(new Paragraph({ alignment:AlignmentType.RIGHT, spacing:{before:0,after:0}, children:[
        new TextRun({ text:'BR-262, km 11,5, s/n – Três Lagoas/MS', font:'Arial', size:18, color:'555555', break:0 }),
        new TextRun({ text:'\n(67) 3522-2400 | carbat@carbat.com.br', font:'Arial', size:18, color:'555555', break:1 }),
      ]}), { width:Math.round(CONTENT_W*0.5), widthType:WidthType.DXA, vAlign:VerticalAlign.BOTTOM, borders:_noBorders() }),
    ]})]
  })

  // Tabela de dados da proposta
  const dadosW1 = 2200, dadosW2 = CONTENT_W - dadosW1
  const dadosRow = (label, value) => new TableRow({ children: [
    _cell(new Paragraph({ children:[new TextRun({text:label, font:'Arial', size:20, bold:true, color:DARK})]}),
      { width:dadosW1, widthType:WidthType.DXA, borders:_noBorders() }),
    _cell(new Paragraph({ children:[new TextRun({text:value||'', font:'Arial', size:20, color:DARK})]}),
      { width:dadosW2, widthType:WidthType.DXA, borders:_noBorders() }),
  ]})

  const dadosTable = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [dadosW1, dadosW2],
    borders: { top:_noBorder(), bottom:_noBorder(), left:_noBorder(), right:_noBorder(), insideH:_noBorder(), insideV:_noBorder() },
    rows: [
      dadosRow('CONTRATANTE:', form.cliente_nome),
      dadosRow('A/C:', form.contato),
      dadosRow('REFERÊNCIA:', form.referencia),
      dadosRow('DATA:', fmtDateDisplay(form.data_proposta)),
      dadosRow('Nº DA PROPOSTA:', form.numero),
    ]
  })

  // Assinaturas
  const assinW = Math.round(CONTENT_W / 2)
  const assinTable = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [assinW, assinW],
    borders: { top:_noBorder(), bottom:_noBorder(), left:_noBorder(), right:_noBorder(), insideH:_noBorder(), insideV:_noBorder() },
    rows: [new TableRow({ children: [
      _cell([
        new Paragraph({ children:[new TextRun({text:'Eng.ª Camila Barcellos Gomes', font:'Arial', size:20, bold:true, color:DARK})] }),
        new Paragraph({ children:[new TextRun({text:'camila@carbat.com.br', font:'Arial', size:18, color:DARK})] }),
        new Paragraph({ children:[new TextRun({text:'(71) 9 3387-4051', font:'Arial', size:18, color:DARK})] }),
      ], { width:assinW, widthType:WidthType.DXA, borders:_noBorders(), vAlign:VerticalAlign.TOP }),
      _cell([
        new Paragraph({ children:[new TextRun({text:'Diretor Renato Gomes Filho', font:'Arial', size:20, bold:true, color:DARK})] }),
        new Paragraph({ children:[new TextRun({text:'renato@carbat.com.br', font:'Arial', size:18, color:DARK})] }),
        new Paragraph({ children:[new TextRun({text:'(67) 9 9244-7793', font:'Arial', size:18, color:DARK})] }),
      ], { width:assinW, widthType:WidthType.DXA, borders:_noBorders(), vAlign:VerticalAlign.TOP }),
    ]})]
  })

  const secao1Children = [
    headerTable,
    _p('', { spaceAfter:160 }),
    dadosTable,
    _p('', { spaceAfter:160 }),
    _p('Prezado Sr(a).,', { size:22 }),
    _p('', { spaceAfter:40 }),
    _p(textoCarta(form.tipo_fornecimento), { size:22, align:AlignmentType.JUSTIFIED }),
    _p('', { spaceAfter:40 }),
    _p('A CARBAT reafirma seu compromisso em atender às expectativas de seus clientes, assegurando a entrega de produtos e serviços com qualidade e dentro dos prazos estabelecidos.', { size:22, align:AlignmentType.JUSTIFIED }),
    _p('', { spaceAfter:40 }),
    _p('Agradecemos a oportunidade de participação e permanecemos à disposição para quaisquer esclarecimentos adicionais que se façam necessários.', { size:22, align:AlignmentType.JUSTIFIED }),
    _p('', { spaceAfter:240 }),
    _p('Atenciosamente,', { size:22 }),
    _p('CARBAT DO BRASIL', { size:22, bold:true }),
    _p('', { spaceAfter:480 }),
    assinTable,
  ]

  // ── Página 2: Conteúdo técnico ────────────────────────────────────────────────

  // Mini header pag2
  const miniHeaderTable = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [Math.round(CONTENT_W*0.4), Math.round(CONTENT_W*0.6)],
    borders: { top:_noBorder(), bottom:{ style:BorderStyle.SINGLE, size:8, color:BLUE }, left:_noBorder(), right:_noBorder(), insideH:_noBorder(), insideV:_noBorder() },
    rows: [new TableRow({ children: [
      _cell(new Paragraph({ children:[logoBuffer
        ? new ImageRun({ data:logoBuffer, transformation:{width:120,height:32}, type:'png' })
        : new TextRun({text:'CARBAT', font:'Arial', size:24, bold:true, color:BLUE})
      ]}), { width:Math.round(CONTENT_W*0.4), widthType:WidthType.DXA, borders:_noBorders() }),
      _cell(new Paragraph({ alignment:AlignmentType.RIGHT, spacing:{before:0,after:0}, children:[
        new TextRun({ text:`Proposta ${form.numero||''} — Rev. ${form.revisao||''} | ${fmtDateDisplay(form.data_proposta)}`, font:'Arial', size:18, color:'888888' })
      ]}), { width:Math.round(CONTENT_W*0.6), widthType:WidthType.DXA, vAlign:VerticalAlign.BOTTOM, borders:_noBorders() }),
    ]})]
  })

  // Tabela de itens do orçamento
  const colWidths = [400, CONTENT_W-400-500-600-900-1000, 500, 600, 900, 1000]
  const itensRows = [
    new TableRow({
      tableHeader: true,
      children: [
        _headerCell('#',          colWidths[0]),
        _headerCell('Descrição',  colWidths[1]),
        _headerCell('Un.',        colWidths[2]),
        _headerCell('Qtd.',       colWidths[3]),
        _headerCell('Unit. R$',   colWidths[4]),
        _headerCell('Total R$',   colWidths[5]),
      ]
    }),
    ...(form.itens||[]).map((it,i) => {
      const total = (Number(it.qtd)||0)*(Number(it.valor)||0)
      const fill  = i%2===0 ? 'FFFFFF' : 'F9F9F9'
      const mk = (text, align=AlignmentType.LEFT) =>
        new Paragraph({ alignment:align, spacing:{before:0,after:0}, children:[new TextRun({text:String(text||''), font:'Arial', size:20, color:DARK})] })
      return new TableRow({ children: [
        _cell(mk(String(i+1), AlignmentType.CENTER), { width:colWidths[0], widthType:WidthType.DXA, fill }),
        _cell(mk(it.descricao||''),                  { width:colWidths[1], widthType:WidthType.DXA, fill }),
        _cell(mk(it.un||'', AlignmentType.CENTER),   { width:colWidths[2], widthType:WidthType.DXA, fill }),
        _cell(mk(String(it.qtd||''), AlignmentType.CENTER), { width:colWidths[3], widthType:WidthType.DXA, fill }),
        _cell(mk(Number(it.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2}), AlignmentType.RIGHT), { width:colWidths[4], widthType:WidthType.DXA, fill }),
        _cell(new Paragraph({ alignment:AlignmentType.RIGHT, spacing:{before:0,after:0}, children:[
          new TextRun({text:total.toLocaleString('pt-BR',{minimumFractionDigits:2}), font:'Arial', size:20, bold:true, color:DARK})
        ]}), { width:colWidths[5], widthType:WidthType.DXA, fill }),
      ]})
    })
  ]

  const itensTable = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: itensRows,
  })

  // Total geral
  const totalRow = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: [new TableRow({ children: [
      _cell(new Paragraph({ alignment:AlignmentType.RIGHT, spacing:{before:0,after:0}, children:[
        new TextRun({ text:`TOTAL GERAL: R$ ${totalGeral.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, font:'Arial', size:24, bold:true, color:BLUE_TEXT })
      ]}), { width:CONTENT_W, widthType:WidthType.DXA, fill:LIGHT_BLUE })
    ]})]
  })

  const docsText = arrToText(form.documentos||'') +
    (form.documentos_enviado_por ? `\n\nEnviados por ${form.documentos_enviado_por}, no dia ${fmtDateDisplay(form.documentos_data)}.` : '')

  const secao2Children = [
    miniHeaderTable,
    _p('', { spaceAfter: 120 }),
    _sectionTitle('1. Itens do Orçamento'),
    _p('', { spaceAfter: 40 }),
    itensTable,
    _p('', { spaceAfter: 60 }),
    totalRow,
    ...(form.observacoes ? _secao('Observações Gerais', form.observacoes) : []),
    ..._secao('Condições de Pagamento', pagamento),
    ..._secao('Validade da Proposta', form.validade_texto),
    ..._secao('Prazo de Entrega', form.prazo_entrega),
    ..._secao('Reajuste', form.reajuste),
    ..._secao('Tributos e Encargos Fiscais', impostos),
    ..._secao('Garantia', form.garantia),
    ..._secaoLista('Escopo de Fornecimento', arrToText([...(form.escopo||[]),...(form.escopo_extra||[])])),
    ..._secaoLista('Fora de Escopo / Escopo Contratante', arrToText([...(form.fora_escopo||[]),...(form.fora_escopo_extra||[])])),
    ..._secao('Ensaios Não Destrutivos', form.ensaios),
    ..._secaoLista('Tratamento Anticorrosivo', arrToText([...(form.tratamento||[]),...(form.tratamento_extra||[])])),
    ..._secaoLista('Data Book Técnico', arrToText([...(form.databook||[]),...(form.databook_extra||[])])),
    ..._secao('Condições de Transporte e Logística', (form.transporte_tipo||'')+(form.transporte_local?'\nLocal: '+form.transporte_local:'')),
    ..._secaoLista('Documentos de Referência Recebidos', docsText),
  ]

  // ── Montar documento ──────────────────────────────────────────────────────────
  const doc = new Document({
    numbering: {
      config: [{
        reference: 'bullets',
        levels: [{ level:0, format:LevelFormat.BULLET, text:'•', alignment:AlignmentType.LEFT,
          style: { paragraph: { indent:{ left:360, hanging:180 } } } }]
      }]
    },
    sections: [
      // Seção 1 – Carta (com quebra de página ao final)
      {
        properties: { page: { size:{ width:A4_W, height:A4_H }, margin:{ top:MARGIN, right:MARGIN, bottom:MARGIN, left:MARGIN } } },
        children: [
          ...secao1Children,
          new Paragraph({ children: [new PageBreak()] }),
        ]
      },
      // Seção 2 – Conteúdo técnico
      {
        properties: { page: { size:{ width:A4_W, height:A4_H }, margin:{ top:MARGIN, right:MARGIN, bottom:MARGIN, left:MARGIN } } },
        children: secao2Children,
      }
    ]
  })

  const blob   = await Packer.toBlob(doc)
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href       = url
  a.download   = buildFilename(form) + '.docx'
  a.click()
  URL.revokeObjectURL(url)
}
