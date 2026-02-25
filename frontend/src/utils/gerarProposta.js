/**
 * gerarProposta.js
 * Exportação de Propostas Comerciais – Carbat
 *
 *   gerarPDF(form)   → abre janela de impressão/PDF no navegador
 *   gerarDOCX(form)  → baixa .doc (HTML-Word) com a mesma estrutura do PDF
 *
 * Estrutura do documento:
 *   Pág 1 – Carta de apresentação (logo, dados, assinaturas)
 *   Pág 2 – Proposta Comercial   (itens + condições comerciais)
 *   Pág 3 – Proposta Técnica     (escopo, tratamento, databook…)
 */

// ─── helpers exportados (usados em PropostasPage) ─────────────────────────────

export function parseDate(val) {
  if (!val) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  if (val.includes('T')) return val.split('T')[0]
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
    const [d, m, y] = val.split('/'); return `${y}-${m}-${d}`
  }
  return ''
}

export function fmtDateDisplay(val) {
  const d = parseDate(val); if (!d) return '—'
  const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`
}

export function arrToText(arr) {
  return (arr || []).filter(Boolean).join('\n')
}

export function buildFilename(form) {
  const clean = (s) => (s || '').replace(/[/\\?%*:|"<>\s]/g, '_').replace(/_+/g, '_')
  return [
    clean(form.numero), clean(form.cliente_nome),
    clean(form.titulo), clean(form.referencia),
    'Rev' + clean(form.revisao)
  ].filter(Boolean).join('_')
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

export function textoCarta(tipo) {
  const t = (tipo || '').toLowerCase()
  if (t.includes('montagem') && t.includes('fabricação'))
    return 'o fornecimento, fabricação, montagem e instalação'
  if (t.includes('montagem') || t.includes('instalação'))
    return 'a montagem e instalação'
  return 'o fornecimento e fabricação'
}

// ─── constantes visuais ───────────────────────────────────────────────────────

const LOGO_URL = 'https://carbat.com.br/wp-content/uploads/2024/06/Carbat-logo-sem-fundo--e1746032537163.png'
const BLUE     = '#1565c0'

// ─── helpers internos de HTML ─────────────────────────────────────────────────

function _esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function _secao(num, titulo, conteudo) {
  if (!conteudo || !conteudo.trim()) return ''
  const linhas = _esc(conteudo).split('\n').map(l =>
    `<p style="margin:2px 0 2px 5px;white-space:pre-wrap;color:#555;font-size:11px;">${l || '&nbsp;'}</p>`
  ).join('')
  return `
    <div style="margin-bottom:18px;page-break-inside:avoid;">
      <div style="background:#f7f9fc;border-left:4px solid ${BLUE};padding:6px 14px;margin:18px 0 8px 0;border-radius:0 4px 4px 0;">
        <span style="font-size:11px;font-weight:bold;color:#333;text-transform:uppercase;">${num}. ${titulo}</span>
      </div>
      ${linhas}
    </div>`
}

function _miniHeader() {
  return `
    <div style="display:flex;align-items:flex-end;justify-content:space-between;
                border-bottom:1px solid #ccc;padding-bottom:12px;margin-bottom:20px;">
      <img src="${LOGO_URL}" style="height:40px;width:auto;object-fit:contain;">
      <div style="text-align:right;font-size:9px;color:#aaa;line-height:1.5;">
        Documento Oficial<br>Carbat do Brasil
      </div>
    </div>`
}

function _h1(texto) {
  return `<h1 style="font-size:18px;color:${BLUE};text-align:right;text-transform:uppercase;
                     border-bottom:2px solid ${BLUE};padding-bottom:8px;
                     margin:30px 0 20px 0;font-weight:300;letter-spacing:2px;
                     page-break-after:avoid;">${texto}</h1>`
}

// ─── constrói as 3 páginas ────────────────────────────────────────────────────

function _buildPages(form) {
  const totalGeral = (form.itens || []).reduce(
    (s, it) => s + (Number(it.qtd) || 0) * (Number(it.valor) || 0), 0
  )

  const pagamento = form.pagamento === 'OUTRO'
    ? (form.pagamento_personalizado || '')
    : (form.pagamento || '')

  const pagamentoFinal = pagamento.toUpperCase().includes('PIX')
    ? pagamento + '\n\nSegue Dados Bancários:\nCARBAT CARBONO ATIVADO DO BRASIL LTDA\nPIX CNPJ: 73.698.573/0002-95\nBANCO: 756 – SICOOB | AGÊNCIA: 4439 | C.C: 127686-7'
    : pagamento

  const impostos = impostosToText(form.impostos)

  const itensRows = (form.itens || []).map((it, i) => {
    const vUnit = Number(it.valor) || 0
    const qtd   = Number(it.qtd)   || 0
    const sub   = vUnit * qtd
    const bg    = i % 2 === 1 ? 'background:#fcfcfc;' : ''
    return `
      <tr style="${bg}page-break-inside:avoid;">
        <td style="text-align:center;border:1px solid #e0e0e0;padding:8px 6px;font-size:11px;">${i + 1}</td>
        <td style="border:1px solid #e0e0e0;padding:8px 6px;font-size:11px;white-space:pre-wrap;">${_esc(it.descricao || '')}</td>
        <td style="text-align:center;border:1px solid #e0e0e0;padding:8px 6px;font-size:11px;">${_esc(it.un || '')}</td>
        <td style="text-align:center;border:1px solid #e0e0e0;padding:8px 6px;font-size:11px;">${it.qtd || ''}</td>
        <td style="text-align:right;border:1px solid #e0e0e0;padding:8px 6px;font-size:11px;">${vUnit.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
        <td style="text-align:right;border:1px solid #e0e0e0;padding:8px 6px;font-size:11px;font-weight:bold;">${sub.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
      </tr>`
  }).join('')

  let cc = 2   // comercial (1 = tabela)
  let ct = 1   // técnica

  const docsArr    = form.documentos || []
  const docsEnvio  = form.documentos_enviado_por
    ? `\n\nEnviados por ${form.documentos_enviado_por}, no dia ${fmtDateDisplay(form.documentos_data)}.`
    : ''
  const docsTexto  = docsArr.filter(Boolean).join('\n') + docsEnvio

  const escopoText     = arrToText([...(form.escopo      || []), ...(form.escopo_extra      || [])])
  const foraEscopoText = arrToText([...(form.fora_escopo || []), ...(form.fora_escopo_extra  || [])])
  const tratamentoText = arrToText([...(form.tratamento  || []), ...(form.tratamento_extra   || [])])
  const databookText   = arrToText([...(form.databook    || []), ...(form.databook_extra     || [])])
  const transporteText = (form.transporte_tipo || '') + (form.transporte_local ? '\nLocal: ' + form.transporte_local : '')

  // ══ PÁG 1 – Carta ══════════════════════════════════════════════════════════
  const pag1 = `
    ${_miniHeader()}

    <div style="background:#fcfcfc;border:1px solid #eee;border-left:4px solid #444;
                padding:16px 18px;margin-bottom:22px;border-radius:4px;">
      <p style="margin:5px 0;"><strong style="display:inline-block;width:140px;color:#000;">CONTRATANTE:</strong>${_esc(form.cliente_nome)}</p>
      <p style="margin:5px 0;"><strong style="display:inline-block;width:140px;color:#000;">A/C:</strong>${_esc(form.contato)}</p>
      <p style="margin:5px 0;"><strong style="display:inline-block;width:140px;color:#000;">REFERÊNCIA:</strong>${_esc(form.referencia)}</p>
      <p style="margin:5px 0;"><strong style="display:inline-block;width:140px;color:#000;">DATA:</strong>${fmtDateDisplay(form.data_proposta)}</p>
      <p style="margin:5px 0;"><strong style="display:inline-block;width:140px;color:#000;">Nº DA PROPOSTA:</strong>${_esc(form.numero)}&nbsp;&nbsp;<strong>REV:</strong>&nbsp;${_esc(form.revisao)}</p>
    </div>

    <div style="margin-top:24px;line-height:1.7;font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#444;">
      <p style="margin-bottom:10px;">Prezado Sr(a).,</p>
      <p style="margin-bottom:10px;text-align:justify;">
        Encaminhamos nossa proposta comercial para <strong>${textoCarta(form.tipo_fornecimento)}</strong>
        conforme descrito no <strong>Item 1</strong> desta proposta. As especificações técnicas apresentadas
        estão em plena conformidade com os documentos previamente encaminhados.
      </p>
      <p style="margin-bottom:10px;text-align:justify;">
        A <strong>CARBAT</strong> reafirma seu compromisso em atender às expectativas de seus clientes,
        assegurando a entrega de produtos e serviços com qualidade e dentro dos prazos estabelecidos.
      </p>
      <p style="margin-bottom:30px;text-align:justify;">
        Agradecemos a oportunidade de participação e permanecemos à disposição para quaisquer
        esclarecimentos adicionais que se façam necessários.
      </p>
      <p style="margin-bottom:4px;">Atenciosamente,</p>
      <p><strong>CARBAT DO BRASIL</strong></p>
    </div>

    <div style="margin-top:60px;display:flex;justify-content:space-around;">
      <div style="text-align:center;font-size:11px;line-height:1.6;flex:1;padding:0 20px;">
        <strong>Eng.ª Camila Barcellos Gomes</strong><br>
        <span style="color:#666;">camila@carbat.com.br<br>(71) 9 9367-4081</span>
      </div>
      <div style="text-align:center;font-size:11px;line-height:1.6;flex:1;padding:0 20px;">
        <strong>Diretor Renato Gomes Filho</strong><br>
        <span style="color:#666;">renato@carbat.com.br<br>(67) 9 9244-7793</span>
      </div>
    </div>`

  // ══ PÁG 2 – Proposta Comercial ═════════════════════════════════════════════
  const pag2 = `
    ${_miniHeader()}
    ${_h1('Proposta Comercial')}

    <div style="margin-bottom:18px;page-break-inside:avoid;">
      <div style="background:#f7f9fc;border-left:4px solid ${BLUE};padding:6px 14px;margin:0 0 8px 0;border-radius:0 4px 4px 0;">
        <span style="font-size:11px;font-weight:bold;color:#333;text-transform:uppercase;">1. ITENS DO ORÇAMENTO</span>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="background:${BLUE};color:#fff;padding:8px 6px;border:1px solid ${BLUE};font-weight:normal;text-transform:uppercase;font-size:11px;text-align:center;width:38px;">Item</th>
            <th style="background:${BLUE};color:#fff;padding:8px 6px;border:1px solid ${BLUE};font-weight:normal;text-transform:uppercase;font-size:11px;text-align:left;">Descrição</th>
            <th style="background:${BLUE};color:#fff;padding:8px 6px;border:1px solid ${BLUE};font-weight:normal;text-transform:uppercase;font-size:11px;text-align:center;width:42px;">Un.</th>
            <th style="background:${BLUE};color:#fff;padding:8px 6px;border:1px solid ${BLUE};font-weight:normal;text-transform:uppercase;font-size:11px;text-align:center;width:42px;">Qtd.</th>
            <th style="background:${BLUE};color:#fff;padding:8px 6px;border:1px solid ${BLUE};font-weight:normal;text-transform:uppercase;font-size:11px;text-align:right;width:85px;">Unit. (R$)</th>
            <th style="background:${BLUE};color:#fff;padding:8px 6px;border:1px solid ${BLUE};font-weight:normal;text-transform:uppercase;font-size:11px;text-align:right;width:95px;">Total (R$)</th>
          </tr>
        </thead>
        <tbody>${itensRows}</tbody>
        <tfoot>
          <tr>
            <td colspan="5" style="text-align:right;border:1px solid #aaa;border-top:2px solid #aaa;padding:8px 6px;font-weight:bold;background:#f0f0f0;font-size:11px;">TOTAL DO PEDIDO</td>
            <td style="text-align:right;border:1px solid #aaa;border-top:2px solid #aaa;padding:8px 6px;font-weight:bold;background:#f0f0f0;font-size:11px;">${totalGeral.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    ${_secao(cc++, 'OBSERVAÇÕES GERAIS',                    form.observacoes)}
    ${_secao(cc++, 'REAJUSTE',                               form.reajuste)}
    ${_secao(cc++, 'TRIBUTOS E ENCARGOS FISCAIS',            impostos)}
    ${_secao(cc++, 'CONDIÇÕES DE PAGAMENTO',                 pagamentoFinal)}
    ${_secao(cc++, 'VALIDADE DA PROPOSTA COMERCIAL',         form.validade_texto)}
    ${_secao(cc++, 'PRAZO DE ENTREGA E CAPACIDADE PRODUTIVA',form.prazo_entrega)}
    ${_secao(cc++, 'GARANTIA',                               form.garantia)}`

  // ══ PÁG 3 – Proposta Técnica ════════════════════════════════════════════════
  const pag3 = `
    ${_miniHeader()}
    ${_h1('Proposta Técnica')}

    ${_secao(ct++, 'ESCOPO DE FORNECIMENTO',               escopoText)}
    ${_secao(ct++, 'FORA DE ESCOPO / ESCOPO CONTRATANTE',  foraEscopoText)}
    ${_secao(ct++, 'ENSAIOS NÃO DESTRUTIVOS (END)',         form.ensaios)}
    ${_secao(ct++, 'TRATAMENTO ANTICORROSIVO',              tratamentoText)}
    ${_secao(ct++, 'DATA BOOK TÉCNICO',                     databookText)}
    ${_secao(ct++, 'CONDIÇÕES DE TRANSPORTE E LOGÍSTICA',   transporteText)}
    ${_secao(ct++, 'DOCUMENTOS DE REFERÊNCIA RECEBIDOS',    docsTexto)}

    <div style="margin-bottom:18px;page-break-inside:avoid;">
      <div style="background:#f7f9fc;border-left:4px solid ${BLUE};padding:6px 14px;margin:18px 0 8px 0;border-radius:0 4px 4px 0;">
        <span style="font-size:11px;font-weight:bold;color:#333;text-transform:uppercase;">${ct++}. INFORMAÇÕES DE CONTATO</span>
      </div>
      <div style="background:#fcfcfc;border:1px solid #eee;padding:14px 16px;font-size:11px;line-height:1.8;border-radius:4px;">
        <strong style="color:${BLUE};">CARBAT CARBONO ATIVADO DO BRASIL LTDA</strong><br>
        <strong>CNPJ:</strong> 73.698.573/0002-95<br>
        <strong>Endereço:</strong> Rodovia BR 262, KM 11.5, S/N, Zona Rural, Três Lagoas/MS<br><br>
        <strong style="color:${BLUE};">Contatos Comerciais:</strong><br>
        • Eng.ª Camila Barcellos Gomes — camila@carbat.com.br — (71) 9 9367-4081<br>
        • Diretor Renato Gomes Filho — renato@carbat.com.br — (67) 9 9244-7793
      </div>
    </div>`

  return { pag1, pag2, pag3 }
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

export function gerarPDF(form) {
  const nome = buildFilename(form)
  const { pag1, pag2, pag3 } = _buildPages(form)

  const PAGE_STYLE = `
    font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#444;
    line-height:1.6;position:relative;`

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${nome}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing:border-box; margin:0; padding:0; }
    body {
      font-family:'Segoe UI',Arial,sans-serif;
      font-size:11px; line-height:1.6; color:#444;
      background:#fff;
      -webkit-print-color-adjust:exact;
      print-color-adjust:exact;
    }
    @media screen {
      body { background:#e0e0e0; padding:20px; }
      .page {
        width:210mm; min-height:257mm; background:#fff;
        margin:0 auto 20px; padding:15mm;
        box-shadow:0 4px 15px rgba(0,0,0,0.12);
        page-break-after:always;
      }
    }
    @media print {
      .page { width:100%; padding:0; page-break-after:always; box-shadow:none; }
      .page:last-child { page-break-after:avoid; }
    }
    .watermark {
      position:fixed; top:50%; left:50%;
      transform:translate(-50%,-50%) rotate(-45deg);
      font-size:140px; font-weight:900;
      color:rgba(0,0,0,0.03);
      pointer-events:none; user-select:none;
      white-space:nowrap; z-index:0;
    }
  </style>
</head>
<body>
  <div class="watermark">CARBAT</div>
  <div class="page" style="${PAGE_STYLE}">${pag1}</div>
  <div class="page" style="${PAGE_STYLE}">${pag2}</div>
  <div class="page" style="${PAGE_STYLE}">${pag3}</div>
  <script>window.onload = () => setTimeout(() => window.print(), 500)<\/script>
</body>
</html>`

  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
}

// ─── DOCX (HTML-Word) ─────────────────────────────────────────────────────────

export function gerarDOCX(form) {
  const nome = buildFilename(form)
  const { pag1, pag2, pag3 } = _buildPages(form)

  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:w="urn:schemas-microsoft-com:office:word"
    xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<title>${nome}</title>
<!--[if gte mso 9]><xml>
  <w:WordDocument>
    <w:View>Print</w:View><w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
  <o:OfficeDocumentSettings><o:AllowPNG/></o:OfficeDocumentSettings>
</xml><![endif]-->
<style>
  @page Section1 {
    size:21.0cm 29.7cm;
    margin:1.5cm 1.5cm 1.5cm 1.5cm;
    mso-header-margin:.5cm; mso-footer-margin:.5cm;
  }
  div.Section1 { page:Section1; }
  body { font-family:Calibri,Arial,sans-serif; font-size:11pt; color:#444; line-height:1.5; }
  p    { margin:4px 0; text-align:justify; }
  table { border-collapse:collapse; width:100%; }
  img  { display:inline-block; }
</style>
</head>
<body><div class="Section1">

${pag1}

<p style="page-break-before:always;margin:0;font-size:1px;">&nbsp;</p>
${pag2}

<p style="page-break-before:always;margin:0;font-size:1px;">&nbsp;</p>
${pag3}

</div></body></html>`

  const blob = new Blob(['\ufeff' + doc], { type:'application/msword;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = nome + '.doc'; a.click()
  URL.revokeObjectURL(url)
}
