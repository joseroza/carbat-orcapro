const router = require("express").Router();
const db = require("../db");

function formatRow(row) {
  if (!row) return row;
  const result = { ...row };
  for (const f of ["data_emissao", "data_entrega"]) {
    if (result[f] instanceof Date) result[f] = result[f].toISOString().split("T")[0];
  }
  return result;
}

function safeDate(val) {
  if (!val || val === "") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  if (val.includes("T")) return val.split("T")[0];
  return null;
}

router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM romaneios ORDER BY created_date DESC");
    res.json(rows.map(formatRow));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/:id", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM romaneios WHERE id=$1", [req.params.id]);
    res.json(formatRow(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/", async (req, res) => {
  try {
    const f = req.body;
    const { rows } = await db.query(
      `INSERT INTO romaneios (numero,proposta_id,proposta_numero,cliente_nome,data_emissao,
       data_entrega,status,endereco_entrega,observacoes,itens)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [f.numero, f.proposta_id||null, f.proposta_numero, f.cliente_nome,
       safeDate(f.data_emissao), safeDate(f.data_entrega),
       f.status||"pendente", f.endereco_entrega, f.observacoes, JSON.stringify(f.itens||[])]
    );
    res.json(formatRow(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put("/:id", async (req, res) => {
  try {
    const f = req.body;
    const { rows } = await db.query(
      `UPDATE romaneios SET numero=$1,proposta_id=$2,proposta_numero=$3,cliente_nome=$4,
       data_emissao=$5,data_entrega=$6,status=$7,endereco_entrega=$8,observacoes=$9,
       itens=$10,updated_date=NOW() WHERE id=$11 RETURNING *`,
      [f.numero, f.proposta_id||null, f.proposta_numero, f.cliente_nome,
       safeDate(f.data_emissao), safeDate(f.data_entrega),
       f.status, f.endereco_entrega, f.observacoes, JSON.stringify(f.itens||[]), req.params.id]
    );
    res.json(formatRow(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM romaneios WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
