const router = require("express").Router();
const db = require("../db");

router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM clientes ORDER BY created_date DESC");
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/:id", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM clientes WHERE id=$1", [req.params.id]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/", async (req, res) => {
  try {
    const f = req.body;
    const { rows } = await db.query(
      `INSERT INTO clientes (razao_social,nome_fantasia,cnpj,email,telefone,endereco,cidade,estado,contato_principal,aprovado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [f.razao_social,f.nome_fantasia,f.cnpj,f.email,f.telefone,f.endereco,f.cidade,f.estado,f.contato_principal,
       f.aprovado !== undefined ? f.aprovado : null]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put("/:id", async (req, res) => {
  try {
    const f = req.body;
    const { rows } = await db.query(
      `UPDATE clientes SET razao_social=$1,nome_fantasia=$2,cnpj=$3,email=$4,telefone=$5,
       endereco=$6,cidade=$7,estado=$8,contato_principal=$9,aprovado=$10,updated_date=NOW()
       WHERE id=$11 RETURNING *`,
      [f.razao_social,f.nome_fantasia,f.cnpj,f.email,f.telefone,f.endereco,f.cidade,f.estado,f.contato_principal,
       f.aprovado !== undefined ? f.aprovado : null,
       req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM clientes WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
