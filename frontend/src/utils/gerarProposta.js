/**
 * gerarProposta.js
 * Exportação de Propostas Comerciais – Carbat
 *
 *   gerarPDF(form)   → abre nova aba e dispara impressão
 *   gerarDOCX(form)  → baixa .doc (HTML-Word)
 *
 * Estrutura:
 *   Pág 1       – Carta de apresentação (isolada, com cabeçalho)
 *   Pág 2       – Proposta Comercial (com cabeçalho)
 *   Pág X       – Proposta Técnica (nova página, SEM cabeçalho repetido)
 *
 * Nome do arquivo: N°_NomeFantasia_Titulo_Referencia_Rev
 *   (usa cliente_nome_fantasia no filename; razão social permanece no documento)
 */

// ─── helpers exportados ───────────────────────────────────────────────────────

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

/**
 * buildFilename — usa nome fantasia no arquivo, razão social continua no documento.
 * form.cliente_nome_fantasia  → preenchido ao selecionar cliente (PropostasPage)
 * Fallback: form.cliente_nome (razão social) caso fantasia esteja vazia
 */
export function buildFilename(form) {
  const clean = (s) => (s || '').trim()
    .replace(/[/\\?%*:|"<>\s]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  const nomeArquivo = form.cliente_nome_fantasia || form.cliente_nome
  return [
    clean(form.numero),
    clean(nomeArquivo),
    clean(form.titulo),
    clean(form.referencia),
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

const LOGO_URL = '/logo.png'
const BLUE     = '#1565c0'
const LOGO_W   = 160
const LOGO_H   = 40

// Converte a logo para base64 (necessário para Word, que não carrega URLs relativas)
async function getLogoBase64() {
  try {
    const resp = await fetch(LOGO_URL)
    const blob = await resp.blob()
    return await new Promise((res, rej) => {
      const r = new FileReader()
      r.onload  = () => res(r.result)   // "data:image/png;base64,..."
      r.onerror = rej
      r.readAsDataURL(blob)
    })
  } catch {
    return LOGO_URL // fallback: tenta URL normal
  }
}

// ─── helpers internos ─────────────────────────────────────────────────────────

function _esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function _renderConteudo(conteudo) {
  if (!conteudo || !conteudo.trim()) return ''
  const linhas = conteudo.split('\n').map(l => l.trim()).filter(Boolean)
  if (linhas.length === 1) {
    return `<p style="margin:2px 0 2px 5px;color:#555;font-size:11px;line-height:1.5;">${_esc(linhas[0])}</p>`
  }
  return linhas.map(l =>
    `<p style="margin:3px 0 3px 5px;color:#555;font-size:11px;line-height:1.5;">&#8226;&nbsp;${_esc(l)}</p>`
  ).join('')
}

function _secao(num, titulo, conteudo) {
  if (!conteudo || !conteudo.trim()) return ''
  return `
    <div style="margin-bottom:14px;page-break-inside:avoid;">
      <div style="background:#f7f9fc;border-left:4px solid ${BLUE};padding:6px 14px;margin:14px 0 6px 0;border-radius:0 4px 4px 0;">
        <span style="font-size:11px;font-weight:bold;color:#333;text-transform:uppercase;">${num}. ${titulo}</span>
      </div>
      ${_renderConteudo(conteudo)}
    </div>`
}

// Cabeçalho com logo
function _cabecalho(logoSrc) {
  return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;border-bottom:1px solid #ccc;">
      <tr>
        <td style="padding-bottom:10px;vertical-align:bottom;">
          <img src="${logoSrc}" width="${LOGO_W}" height="${LOGO_H}"
               style="width:${LOGO_W}px;height:${LOGO_H}px;max-width:${LOGO_W}px;object-fit:contain;display:block;">
        </td>
        <td style="padding-bottom:10px;vertical-align:bottom;text-align:right;font-size:9px;color:#aaa;line-height:1.5;">
          Documento Oficial<br>Carbat do Brasil
        </td>
      </tr>
    </table>`
}

// H1 sem quebra (Proposta Comercial)
function _h1(texto) {
  return `<h1 style="font-size:17px;color:${BLUE};text-align:right;text-transform:uppercase;
                     border-bottom:2px solid ${BLUE};padding-bottom:7px;
                     margin:0 0 14px 0;font-weight:300;letter-spacing:2px;
                     page-break-after:avoid;">${texto}</h1>`
}

// H1 com page-break antes (Proposta Técnica — nova página, sem cabeçalho)
function _h1NewPage(texto) {
  return `<h1 style="font-size:17px;color:${BLUE};text-align:right;text-transform:uppercase;
                     border-bottom:2px solid ${BLUE};padding-bottom:7px;
                     margin:0 0 14px 0;font-weight:300;letter-spacing:2px;
                     page-break-before:always;page-break-after:avoid;">${texto}</h1>`
}

// ─── montagem do conteúdo ─────────────────────────────────────────────────────

function _buildContent(form, logoSrc) {
  const totalGeral = (form.itens || []).reduce(
    (s, it) => s + (Number(it.qtd) || 0) * (Number(it.valor) || 0), 0
  )

  const pagamento = form.pagamento === 'OUTRO'
    ? (form.pagamento_personalizado || '')
    : (form.pagamento || '')

  const pagamentoFinal = pagamento.toUpperCase().includes('PIX')
    ? pagamento + '\n\nSegue Dados Bancários:\nCARBAT CARBONO ATIVADO DO BRASIL LTDA\nPIX CNPJ: 73.698.573/0002-95\nBANCO: 756 – SICOOB | AGÊNCIA: 4439 | C.C: 127686-7'
    : pagamento

  const pagamentoCorrigido = pagamentoFinal.replace(/Notas Fiscal/gi, 'Nota Fiscal')
  const impostos           = impostosToText(form.impostos)

  const itensRows = (form.itens || []).map((it, i) => {
    const vUnit = Number(it.valor) || 0
    const qtd   = Number(it.qtd)   || 0
    const sub   = vUnit * qtd
    const bg    = i % 2 === 1 ? 'background:#fcfcfc;' : ''
    return `
      <tr style="${bg}page-break-inside:avoid;">
        <td style="text-align:center;border:1px solid #e0e0e0;padding:7px 5px;font-size:11px;line-height:1.5;">${i + 1}</td>
        <td style="border:1px solid #e0e0e0;padding:7px 5px;font-size:11px;line-height:1.5;white-space:pre-wrap;">${_esc(it.descricao || '')}</td>
        <td style="text-align:center;border:1px solid #e0e0e0;padding:7px 5px;font-size:11px;line-height:1.5;">${_esc(it.un || '')}</td>
        <td style="text-align:center;border:1px solid #e0e0e0;padding:7px 5px;font-size:11px;line-height:1.5;">${it.qtd || ''}</td>
        <td style="text-align:right;border:1px solid #e0e0e0;padding:7px 5px;font-size:11px;line-height:1.5;">${vUnit.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
        <td style="text-align:right;border:1px solid #e0e0e0;padding:7px 5px;font-size:11px;line-height:1.5;font-weight:bold;">${sub.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
      </tr>`
  }).join('')

  let cc = 2
  let ct = 1

  const docsArr   = form.documentos || []
  const docsEnvio = form.documentos_enviado_por
    ? `\n\nEnviados por ${form.documentos_enviado_por}, no dia ${fmtDateDisplay(form.documentos_data)}.`
    : ''
  const docsTexto      = docsArr.filter(Boolean).join('\n') + docsEnvio
  const escopoText     = arrToText([...(form.escopo      || []), ...(form.escopo_extra      || [])])
  const foraEscopoText = arrToText([...(form.fora_escopo || []), ...(form.fora_escopo_extra  || [])])
  const tratamentoText = arrToText([...(form.tratamento  || []), ...(form.tratamento_extra   || [])])
  const databookText   = arrToText([...(form.databook    || []), ...(form.databook_extra     || [])])
  const transporteText = (form.transporte_tipo || '') + (form.transporte_local ? '\nLocal: ' + form.transporte_local : '')
  const validadeCorrigida = (form.validade_texto || '').replace(/\(Trinta\)/g, '(trinta)')

  // ── PÁG 1: Carta — usa razão social (cliente_nome) no documento ───────────
  const carta = `
    ${_cabecalho(logoSrc)}

    <div style="background:#fcfcfc;border:1px solid #eee;border-left:4px solid #444;
                padding:16px 18px;margin-bottom:22px;border-radius:4px;line-height:1.5;">
      <p style="margin:5px 0;font-size:11px;"><strong style="display:inline-block;width:140px;color:#000;">CONTRATANTE:</strong>${_esc(form.cliente_nome)}</p>
      <p style="margin:5px 0;font-size:11px;"><strong style="display:inline-block;width:140px;color:#000;">A/C:</strong>${_esc(form.contato)}</p>
      <p style="margin:5px 0;font-size:11px;"><strong style="display:inline-block;width:140px;color:#000;">REFERÊNCIA:</strong>${_esc(form.referencia)}</p>
      <p style="margin:5px 0;font-size:11px;"><strong style="display:inline-block;width:140px;color:#000;">TÍTULO:</strong>${_esc(form.titulo)}</p>
      <p style="margin:5px 0;font-size:11px;"><strong style="display:inline-block;width:140px;color:#000;">DATA:</strong>${fmtDateDisplay(form.data_proposta)}</p>
      <p style="margin:5px 0;font-size:11px;"><strong style="display:inline-block;width:140px;color:#000;">Nº DA PROPOSTA:</strong>${_esc(form.numero)}&nbsp;&nbsp;<strong>REV:</strong>&nbsp;${_esc(form.revisao)}</p>
    </div>

    <div style="margin-top:24px;line-height:1.5;font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#444;">
      <p style="margin-bottom:12px;">Prezado Sr(a).,</p>
      <p style="margin-bottom:12px;text-align:justify;">
        Encaminhamos nossa proposta comercial para <strong>${textoCarta(form.tipo_fornecimento)}</strong>
        conforme descrito no <strong>Item 1</strong> desta proposta. As especificações técnicas apresentadas
        estão em plena conformidade com os documentos previamente encaminhados.
      </p>
      <p style="margin-bottom:12px;text-align:justify;">
        A <strong>CARBAT</strong> reafirma seu compromisso em atender às expectativas de seus clientes,
        assegurando a entrega de produtos e serviços com qualidade e dentro dos prazos estabelecidos.
      </p>
      <p style="margin-bottom:32px;text-align:justify;">
        Agradecemos a oportunidade de participação e permanecemos à disposição para quaisquer
        esclarecimentos adicionais que se façam necessários.
      </p>
      <p style="margin-bottom:4px;">Atenciosamente,</p>
      <p><strong>CARBAT DO BRASIL</strong></p>
    </div>

    <table style="width:100%;margin-top:60px;border-collapse:collapse;table-layout:fixed;">
      <tr>
        <td style="width:50%;text-align:center;font-size:11px;line-height:1.5;padding:0 20px;">
          <strong>Eng.ª Camila Barcellos Gomes</strong><br>
          <span style="color:#666;">camila@carbat.com.br<br>(71) 9 9367-4081</span>
        </td>
        <td style="width:50%;text-align:center;font-size:11px;line-height:1.5;padding:0 20px;">
          <strong>Diretor Renato Gomes Filho</strong><br>
          <span style="color:#666;">renato@carbat.com.br<br>(67) 9 9244-7793</span>
        </td>
      </tr>
    </table>`

  // ── BLOCO CONTÍNUO: Comercial (com cabeçalho) + Técnica (só nova página) ──
  const conteudo = `
    ${_cabecalho(logoSrc)}
    ${_h1('Proposta Comercial')}

    <div style="margin-bottom:14px;page-break-inside:avoid;">
      <div style="background:#f7f9fc;border-left:4px solid ${BLUE};padding:6px 14px;margin:0 0 6px 0;border-radius:0 4px 4px 0;">
        <span style="font-size:11px;font-weight:bold;color:#333;text-transform:uppercase;">1. ITENS DO ORÇAMENTO</span>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="background:${BLUE};color:#fff;padding:7px 5px;border:1px solid ${BLUE};font-weight:normal;text-transform:uppercase;font-size:11px;text-align:center;width:38px;">Item</th>
            <th style="background:${BLUE};color:#fff;padding:7px 5px;border:1px solid ${BLUE};font-weight:normal;text-transform:uppercase;font-size:11px;text-align:left;">Descrição</th>
            <th style="background:${BLUE};color:#fff;padding:7px 5px;border:1px solid ${BLUE};font-weight:normal;text-transform:uppercase;font-size:11px;text-align:center;width:42px;">Un.</th>
            <th style="background:${BLUE};color:#fff;padding:7px 5px;border:1px solid ${BLUE};font-weight:normal;text-transform:uppercase;font-size:11px;text-align:center;width:42px;">Qtd.</th>
            <th style="background:${BLUE};color:#fff;padding:7px 5px;border:1px solid ${BLUE};font-weight:normal;text-transform:uppercase;font-size:11px;text-align:right;width:85px;">Unit. (R$)</th>
            <th style="background:${BLUE};color:#fff;padding:7px 5px;border:1px solid ${BLUE};font-weight:normal;text-transform:uppercase;font-size:11px;text-align:right;width:95px;">Total (R$)</th>
          </tr>
        </thead>
        <tbody>${itensRows}</tbody>
        <tfoot>
          <tr>
            <td colspan="5" style="text-align:right;border:1px solid #aaa;border-top:2px solid #aaa;padding:7px 5px;font-weight:bold;background:#f0f0f0;font-size:11px;">TOTAL DO PEDIDO</td>
            <td style="text-align:right;border:1px solid #aaa;border-top:2px solid #aaa;padding:7px 5px;font-weight:bold;background:#f0f0f0;font-size:11px;">${totalGeral.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    ${_secao(cc++, 'OBSERVAÇÕES GERAIS',                     form.observacoes)}
    ${_secao(cc++, 'REAJUSTE',                               form.reajuste)}
    ${_secao(cc++, 'TRIBUTOS E ENCARGOS FISCAIS',            impostos)}
    ${_secao(cc++, 'CONDIÇÕES DE PAGAMENTO',                 pagamentoCorrigido)}
    ${_secao(cc++, 'VALIDADE DA PROPOSTA COMERCIAL',         validadeCorrigida)}
    ${_secao(cc++, 'PRAZO DE ENTREGA E CAPACIDADE PRODUTIVA',form.prazo_entrega)}
    ${_secao(cc++, 'GARANTIA',                               form.garantia)}

    ${_h1NewPage('Proposta Técnica')}

    ${_secao(ct++, 'ESCOPO DE FORNECIMENTO',               escopoText)}
    ${_secao(ct++, 'FORA DE ESCOPO / ESCOPO CONTRATANTE',  foraEscopoText)}
    ${_secao(ct++, 'ENSAIOS NÃO DESTRUTIVOS (END)',         form.ensaios)}
    ${_secao(ct++, 'TRATAMENTO ANTICORROSIVO',              tratamentoText)}
    ${_secao(ct++, 'DATA BOOK TÉCNICO',                     databookText)}
    ${_secao(ct++, 'CONDIÇÕES DE TRANSPORTE E LOGÍSTICA',   transporteText)}
    ${_secao(ct++, 'DOCUMENTOS DE REFERÊNCIA RECEBIDOS',    docsTexto)}

    <div style="margin-bottom:14px;page-break-inside:avoid;">
      <div style="background:#f7f9fc;border-left:4px solid ${BLUE};padding:6px 14px;margin:14px 0 6px 0;border-radius:0 4px 4px 0;">
        <span style="font-size:11px;font-weight:bold;color:#333;text-transform:uppercase;">${ct++}. INFORMAÇÕES DE CONTATO</span>
      </div>
      <div style="background:#fcfcfc;border:1px solid #eee;padding:14px 16px;font-size:11px;line-height:1.5;border-radius:4px;">
        <strong style="color:${BLUE};">CARBAT CARBONO ATIVADO DO BRASIL LTDA</strong><br>
        <strong>CNPJ:</strong> 73.698.573/0002-95<br>
        <strong>Endereço:</strong> Rodovia BR 262, KM 11.5, S/N, Zona Rural, Três Lagoas/MS<br><br>
        <strong style="color:${BLUE};">Contatos Comerciais:</strong><br>
        &#8226; Eng.ª Camila Barcellos Gomes — camila@carbat.com.br — (71) 9 9367-4081<br>
        &#8226; Diretor Renato Gomes Filho — renato@carbat.com.br — (67) 9 9244-7793
      </div>
    </div>`

  return { carta, conteudo }
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

export function gerarPDF(form) {
  const nome = buildFilename(form)
  const { carta, conteudo } = _buildContent(form, LOGO_URL)

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${_esc(nome)}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11px; line-height: 1.5; color: #444;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .pag-carta { page-break-after: always; }
    .wm {
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 140px; font-weight: 900; color: rgba(0,0,0,0.03);
      pointer-events: none; user-select: none; white-space: nowrap; z-index: 0;
    }
    @media screen {
      body { background: #e8e8e8; padding: 20px; }
      .pag-carta {
        background: #fff; width: 210mm; min-height: 297mm;
        margin: 0 auto 20px auto; padding: 15mm;
        box-shadow: 0 2px 12px rgba(0,0,0,0.15);
      }
      .bloco {
        background: #fff; width: 210mm;
        margin: 0 auto; padding: 15mm;
        box-shadow: 0 2px 12px rgba(0,0,0,0.15);
      }
    }
  </style>
</head>
<body>
  <div class="wm">CARBAT</div>
  <div class="pag-carta">${carta}</div>
  <div class="bloco">${conteudo}</div>
  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 800); };
  <\/script>
</body>
</html>`

  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close() }
}

// ─── DOCX (HTML-Word) ────────────────────────────────────────────────────────

export async function gerarDOCX(form) {
  const nome = buildFilename(form)
  const logoSrc = await getLogoBase64()
  const { carta, conteudo } = _buildContent(form, logoSrc)

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
  p    { margin:4px 0; text-align:justify; line-height:1.5; }
  table { border-collapse:collapse; width:100%; }
  img  { display:inline-block; }
</style>
</head>
<body>
<div class="Section1">
  ${carta}
  <p style="page-break-before:always;margin:0;font-size:1px;">&nbsp;</p>
  ${conteudo}
</div>
</body>
</html>`

  const blob = new Blob(['\ufeff' + doc], { type:'application/msword;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = nome + '.doc'; a.click()
  URL.revokeObjectURL(url)
}