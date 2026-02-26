const router = require("express").Router();
const db = require("../db");
const jwt = require("jsonwebtoken");
const { authMiddleware, adminMiddleware, JWT_SECRET } = require("../middleware/auth.middleware");

// ─── Login ────────────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { login, senha } = req.body;
    if (!login || !senha) return res.status(400).json({ error: "Login e senha são obrigatórios." });

    // Busca usuário e valida senha com pgcrypto
    const { rows } = await db.query(
      `SELECT id, nome, login, perfil, ativo
       FROM usuarios
       WHERE login = $1
         AND senha_hash = crypt($2, senha_hash)`,
      [login.trim().toLowerCase(), senha]
    );

    const usuario = rows[0];
    if (!usuario) return res.status(401).json({ error: "Login ou senha incorretos." });
    if (!usuario.ativo) return res.status(403).json({ error: "Usuário desativado. Contate o administrador." });

    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, login: usuario.login, perfil: usuario.perfil },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, login: usuario.login, perfil: usuario.perfil } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Retorna dados do usuário logado ──────────────────────────────────────────
router.get("/me", authMiddleware, (req, res) => {
  res.json(req.usuario);
});

// ─── Listar usuários (admin) ──────────────────────────────────────────────────
router.get("/usuarios", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT id, nome, login, perfil, ativo, created_date FROM usuarios ORDER BY created_date ASC"
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Criar usuário (admin) ────────────────────────────────────────────────────
router.post("/usuarios", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { nome, login, senha, perfil } = req.body;
    if (!nome || !login || !senha) return res.status(400).json({ error: "Nome, login e senha são obrigatórios." });

    const { rows } = await db.query(
      `INSERT INTO usuarios (nome, login, senha_hash, perfil)
       VALUES ($1, $2, crypt($3, gen_salt('bf', 10)), $4)
       RETURNING id, nome, login, perfil, ativo, created_date`,
      [nome.trim(), login.trim().toLowerCase(), senha, perfil || "usuario"]
    );
    res.json(rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(400).json({ error: "Esse login já está em uso." });
    res.status(500).json({ error: e.message });
  }
});

// ─── Atualizar usuário (admin) ────────────────────────────────────────────────
router.put("/usuarios/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { nome, login, senha, perfil, ativo } = req.body;
    const { id } = req.params;

    // Impede o admin de desativar a si mesmo
    if (req.usuario.id === id && ativo === false) {
      return res.status(400).json({ error: "Você não pode desativar sua própria conta." });
    }

    // Se enviou nova senha, atualiza com hash — senão mantém a atual
    if (senha && senha.trim()) {
      await db.query(
        `UPDATE usuarios SET nome=$1, login=$2, senha_hash=crypt($3, gen_salt('bf',10)), perfil=$4, ativo=$5, updated_date=NOW()
         WHERE id=$6`,
        [nome.trim(), login.trim().toLowerCase(), senha, perfil, ativo, id]
      );
    } else {
      await db.query(
        `UPDATE usuarios SET nome=$1, login=$2, perfil=$3, ativo=$4, updated_date=NOW()
         WHERE id=$5`,
        [nome.trim(), login.trim().toLowerCase(), perfil, ativo, id]
      );
    }

    const { rows } = await db.query(
      "SELECT id, nome, login, perfil, ativo, created_date FROM usuarios WHERE id=$1",
      [id]
    );
    res.json(rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(400).json({ error: "Esse login já está em uso." });
    res.status(500).json({ error: e.message });
  }
});

// ─── Excluir usuário (admin) ──────────────────────────────────────────────────
router.delete("/usuarios/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (req.usuario.id === req.params.id) {
      return res.status(400).json({ error: "Você não pode excluir sua própria conta." });
    }
    await db.query("DELETE FROM usuarios WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
