const crypto = require('crypto')

const KEY = process.env.ENCRYPTION_KEY || 'carbat-orcapro-chave-secreta-2024'

// Deriva uma chave de 32 bytes a partir da KEY
const DERIVED_KEY = crypto.scryptSync(KEY, 'carbat-salt', 32)
const ALGORITHM = 'aes-256-gcm'

/**
 * Criptografa um valor string
 */
function encrypt(text) {
  if (!text && text !== 0) return text
  const str = String(text)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, DERIVED_KEY, iv)
  const encrypted = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Formato: iv(24) + tag(32) + dados
  return iv.toString('hex') + tag.toString('hex') + encrypted.toString('hex')
}

/**
 * Descriptografa um valor
 */
function decrypt(text) {
  if (!text) return text
  try {
    const iv = Buffer.from(text.slice(0, 24), 'hex')
    const tag = Buffer.from(text.slice(24, 56), 'hex')
    const encrypted = Buffer.from(text.slice(56), 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, DERIVED_KEY, iv)
    decipher.setAuthTag(tag)
    return decipher.update(encrypted) + decipher.final('utf8')
  } catch (e) {
    // Se não conseguir descriptografar, retorna o valor original (compatibilidade)
    return text
  }
}

// Campos sensíveis por tabela
const CLIENTE_FIELDS = ['razao_social', 'nome_fantasia', 'cnpj', 'email', 'telefone', 'contato_principal', 'endereco', 'cidade']
const PROPOSTA_FIELDS = ['cliente_nome', 'contato']
const ROMANEIO_FIELDS = ['cliente_nome', 'endereco_entrega']

function encryptCliente(obj) {
  if (!obj) return obj
  const r = { ...obj }
  for (const f of CLIENTE_FIELDS) if (r[f]) r[f] = encrypt(r[f])
  return r
}

function decryptCliente(obj) {
  if (!obj) return obj
  const r = { ...obj }
  for (const f of CLIENTE_FIELDS) if (r[f]) r[f] = decrypt(r[f])
  return r
}

function encryptProposta(obj) {
  if (!obj) return obj
  const r = { ...obj }
  for (const f of PROPOSTA_FIELDS) if (r[f]) r[f] = encrypt(r[f])
  return r
}

function decryptProposta(obj) {
  if (!obj) return obj
  const r = { ...obj }
  for (const f of PROPOSTA_FIELDS) if (r[f]) r[f] = decrypt(r[f])
  return r
}

function encryptRomaneio(obj) {
  if (!obj) return obj
  const r = { ...obj }
  for (const f of ROMANEIO_FIELDS) if (r[f]) r[f] = encrypt(r[f])
  return r
}

function decryptRomaneio(obj) {
  if (!obj) return obj
  const r = { ...obj }
  for (const f of ROMANEIO_FIELDS) if (r[f]) r[f] = decrypt(r[f])
  return r
}

module.exports = {
  encrypt, decrypt,
  encryptCliente, decryptCliente,
  encryptProposta, decryptProposta,
  encryptRomaneio, decryptRomaneio,
}
