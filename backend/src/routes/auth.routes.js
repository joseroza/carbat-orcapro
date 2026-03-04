const router = require("express").Router();
const db = require("../db");
const jwt = require("jsonwebtoken");
const { authMiddleware, adminMiddleware, JWT_SECRET } = require("../middleware/auth.middleware");

// Permissões padrão para novo usuário
const DEFAULT_PERMISSOES = {
  propostas_ver: true,
  propostas_criar: false,
  propostas_editar: false,
  propostas_excluir: false,
  propostas_exportar: true,
  propostas_revisao: false,
  clientes_ver: true,
  clientes_criar: false,
  clientes_editar: false,
  clientes_excluir: false,
  romaneios_ver: true,
  romaneios_criar: false,
  romaneios_editar: false,
  romaneios_excluir: false,
}

// ─── Login ────────────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { login, senha } = req.body;
    if (!login || !senha) return res.status(400).json({ error: "Login e senha são obrigatórios." });

    const { rows } = await db.query(
      `SELECT id, nome, login, perfil, ativo, permissoes
       FROM usuarios
       WHERE login = $1
         AND senha_hash = crypt($2, senha_hash)`,
      [login.trim().toLowerCase(), senha]
    );

    const usuario = rows[0];
    if (!usuario) return res.status(401).json({ error: "Login ou senha incorretos." });
    if (!usuario.ativo) return res.status(403).json({ error: "Usuário desativado. Contate o administrador." });

    // Admin tem todas as permissões automaticamente
    const permissoes = usuario.perfil === 'admin'
      ? Object.fromEntries(Object.keys(DEFAULT_PERMISSOES).map(k => [k, true]))
      : (usuario.permissoes || DEFAULT_PERMISSOES)

    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, login: usuario.login, perfil: usuario.perfil, permissoes },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, login: usuario.login, perfil: usuario.perfil, permissoes } });
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
      "SELECT id, nome, login, perfil, ativo, permissoes, created_date FROM usuarios ORDER BY created_date ASC"
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Criar usuário (admin) ────────────────────────────────────────────────────
router.post("/usuarios", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { nome, login, senha, perfil, permissoes } = req.body;
    if (!nome || !login || !senha) return res.status(400).json({ error: "Nome, login e senha são obrigatórios." });

    const perms = perfil === 'admin'
      ? Object.fromEntries(Object.keys(DEFAULT_PERMISSOES).map(k => [k, true]))
      : (permissoes || DEFAULT_PERMISSOES)

    const { rows } = await db.query(
      `INSERT INTO usuarios (nome, login, senha_hash, perfil, permissoes)
       VALUES ($1, $2, crypt($3, gen_salt('bf', 10)), $4, $5)
       RETURNING id, nome, login, perfil, ativo, permissoes, created_date`,
      [nome.trim(), login.trim().toLowerCase(), senha, perfil || "usuario", JSON.stringify(perms)]
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
    const { nome, login, senha, perfil, ativo, permissoes } = req.body;
    const { id } = req.params;

    if (req.usuario.id === id && ativo === false) {
      return res.status(400).json({ error: "Você não pode desativar sua própria conta." });
    }

    const perms = perfil === 'admin'
      ? Object.fromEntries(Object.keys(DEFAULT_PERMISSOES).map(k => [k, true]))
      : (permissoes || DEFAULT_PERMISSOES)

    if (senha && senha.trim()) {
      await db.query(
        `UPDATE usuarios SET nome=$1, login=$2, senha_hash=crypt($3, gen_salt('bf',10)), perfil=$4, ativo=$5, permissoes=$6, updated_date=NOW()
         WHERE id=$7`,
        [nome.trim(), login.trim().toLowerCase(), senha, perfil, ativo, JSON.stringify(perms), id]
      );
    } else {
      await db.query(
        `UPDATE usuarios SET nome=$1, login=$2, perfil=$3, ativo=$4, permissoes=$5, updated_date=NOW()
         WHERE id=$6`,
        [nome.trim(), login.trim().toLowerCase(), perfil, ativo, JSON.stringify(perms), id]
      );
    }

    const { rows } = await db.query(
      "SELECT id, nome, login, perfil, ativo, permissoes, created_date FROM usuarios WHERE id=$1",
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
