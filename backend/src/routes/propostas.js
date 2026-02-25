const router = require("express").Router();
const db = require("../db");

// Retorna datas como string YYYY-MM-DD sem conversão de timezone
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

// Aceita data como string YYYY-MM-DD ou null
function safeDate(val) {
  if (!val || val === "") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  if (val.includes("T")) return val.split("T")[0];
  return null;
}

router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM propostas ORDER BY created_date DESC");
    res.json(rows.map(formatRow));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/:id", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM propostas WHERE id=$1", [req.params.id]);
    res.json(formatRow(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/", async (req, res) => {
  try {
    const f = req.body;
    // condicoes_pagamento aceita tanto o campo novo quanto o legado
    const pagamento = f.condicoes_pagamento || f.pagamento || null;
    const { rows } = await db.query(
      `INSERT INTO propostas (numero,revisao,cliente_id,cliente_nome,contato,referencia,titulo,
       tipo_fornecimento,valor_total,status,data_proposta,validade_texto,condicoes_pagamento,
       prazo_entrega,observacoes,reajuste,impostos,garantia,escopo,fora_escopo,ensaios,
       tratamento,databook,transporte,documentos,documentos_data,itens)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
       RETURNING *`,
      [f.numero, f.revisao, f.cliente_id||null, f.cliente_nome, f.contato, f.referencia, f.titulo,
       f.tipo_fornecimento, f.valor_total||0, f.status||"rascunho",
       safeDate(f.data_proposta), f.validade_texto, pagamento,
       f.prazo_entrega, f.observacoes, f.reajuste, f.impostos, f.garantia,
       f.escopo, f.fora_escopo, f.ensaios, f.tratamento, f.databook,
       f.transporte, f.documentos, safeDate(f.documentos_data),
       JSON.stringify(f.itens || [])]
    );
    res.json(formatRow(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put("/:id", async (req, res) => {
  try {
    const f = req.body;
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
       JSON.stringify(f.itens || []), req.params.id]
    );
    res.json(formatRow(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM propostas WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
