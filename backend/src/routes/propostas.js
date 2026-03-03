const router = require("express").Router();
const db = require("../db");
const { encryptProposta, decryptProposta } = require("../middleware/crypto.middleware");

function formatRow(row) {
  if (!row) return row;
  const dateFields = ["data_proposta", "data_validade", "documentos_data"];
  const result = { ...row };
  for (const f of dateFields) {
    if (result[f] instanceof Date) {
      result[f] = result[f].toISOString().split("T")[0];
    }
  }
  return result;
}

function safeDate(val) {
  if (!val || val === "") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  if (val.includes("T")) return val.split("T")[0];
  return null;
}

// Incrementa revisão: 0.0 → 1.0 → 2.0
function bumpRevisao(rev) {
  if (!rev) return "1.0";
  const n = parseFloat(rev);
  return isNaN(n) ? "1.0" : (Math.floor(n) + 1) + ".0";
}

// ─── Listar propostas ─────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM propostas ORDER BY created_date DESC");
    res.json(rows.map(r => decryptProposta(formatRow(r))));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Buscar proposta por ID ───────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM propostas WHERE id=$1", [req.params.id]);
    res.json(decryptProposta(formatRow(rows[0])));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Listar histórico de revisões de uma proposta ─────────────────────────────
router.get("/:id/revisoes", async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, proposta_id, revisao, criado_por, created_date, snapshot
       FROM proposta_revisoes
       WHERE proposta_id = $1
       ORDER BY created_date DESC`,
      [req.params.id]
    );
    // Descriptografa os campos sensíveis dentro do snapshot
    const revisoes = rows.map(r => ({
      ...r,
      snapshot: decryptProposta(r.snapshot)
    }));
    res.json(revisoes);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Gerar nova revisão (somente quando status = 'enviada') ───────────────────
router.post("/:id/revisao", async (req, res) => {
  try {
    const { id } = req.params;
    const criado_por = req.usuario?.nome || "sistema";

    // Busca proposta atual
    const { rows: atual } = await db.query("SELECT * FROM propostas WHERE id=$1", [id]);
    if (!atual[0]) return res.status(404).json({ error: "Proposta não encontrada." });

    const proposta = decryptProposta(formatRow(atual[0]));

    // Só permite gerar revisão se status for 'enviada'
    if (proposta.status !== "enviada") {
      return res.status(400).json({ error: "Revisão só pode ser gerada quando o status for 'enviada'." });
    }

    const revisaoAtual = proposta.revisao || "0.0";
    const novaRevisao  = bumpRevisao(revisaoAtual);

    // Salva snapshot da versão atual antes de incrementar
    await db.query(
      `INSERT INTO proposta_revisoes (proposta_id, revisao, snapshot, criado_por)
       VALUES ($1, $2, $3, $4)`,
      [id, revisaoAtual, JSON.stringify(encryptProposta(proposta)), criado_por]
    );

    // Atualiza revisão da proposta principal
    const { rows: updated } = await db.query(
      `UPDATE propostas SET revisao=$1, updated_date=NOW() WHERE id=$2 RETURNING *`,
      [novaRevisao, id]
    );

    res.json({
      proposta: decryptProposta(formatRow(updated[0])),
      revisao_gerada: revisaoAtual,
      nova_revisao: novaRevisao,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Criar proposta ───────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const f = encryptProposta(req.body);
    const pagamento = f.condicoes_pagamento || f.pagamento || null;
    const { rows } = await db.query(
      `INSERT INTO propostas (numero,revisao,cliente_id,cliente_nome,contato,referencia,titulo,
       tipo_fornecimento,valor_total,status,data_proposta,validade_texto,condicoes_pagamento,
       prazo_entrega,observacoes,reajuste,impostos,garantia,escopo,fora_escopo,ensaios,
       tratamento,databook,transporte,documentos,documentos_data,itens)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
       RETURNING *`,
      [f.numero, f.revisao || "0.0", f.cliente_id||null, f.cliente_nome, f.contato,
       f.referencia, f.titulo, f.tipo_fornecimento, f.valor_total||0, f.status||"rascunho",
       safeDate(f.data_proposta), f.validade_texto, pagamento,
       f.prazo_entrega, f.observacoes, f.reajuste, f.impostos, f.garantia,
       f.escopo, f.fora_escopo, f.ensaios, f.tratamento, f.databook,
       f.transporte, f.documentos, safeDate(f.documentos_data),
       JSON.stringify(req.body.itens || [])]
    );
    res.json(decryptProposta(formatRow(rows[0])));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Atualizar proposta ───────────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const f = encryptProposta(req.body);
    const pagamento = f.condicoes_pagamento || f.pagamento || null;
    const { rows } = await db.query(
      `UPDATE propostas SET numero=$1,revisao=$2,cliente_id=$3,cliente_nome=$4,contato=$5,
       referencia=$6,titulo=$7,tipo_fornecimento=$8,valor_total=$9,status=$10,data_proposta=$11,
       validade_texto=$12,condicoes_pagamento=$13,prazo_entrega=$14,observacoes=$15,reajuste=$16,
       impostos=$17,garantia=$18,escopo=$19,fora_escopo=$20,ensaios=$21,tratamento=$22,databook=$23,
       transporte=$24,documentos=$25,documentos_data=$26,itens=$27,updated_date=NOW()
       WHERE id=$28 RETURNING *`,
      [f.numero, f.revisao, f.cliente_id||null, f.cliente_nome, f.contato, f.referencia, f.titulo,
       f.tipo_fornecimento, f.valor_total||0, f.status,
       safeDate(f.data_proposta), f.validade_texto, pagamento,
       f.prazo_entrega, f.observacoes, f.reajuste, f.impostos, f.garantia,
       f.escopo, f.fora_escopo, f.ensaios, f.tratamento, f.databook,
       f.transporte, f.documentos, safeDate(f.documentos_data),
       JSON.stringify(req.body.itens || []), req.params.id]
    );
    res.json(decryptProposta(formatRow(rows[0])));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Excluir proposta ─────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM propostas WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
