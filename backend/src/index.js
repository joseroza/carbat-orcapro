const express = require("express");
const cors = require("cors");
const path = require("path");
const app = express();

app.use(cors());
app.use(express.json());

const { authMiddleware } = require('./middleware/auth.middleware');

// ─── Rotas públicas ───────────────────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth.routes"));
app.get("/api/health", (req, res) => res.json({ ok: true }));

// ─── Rotas protegidas ─────────────────────────────────────────────────────────
app.use("/api/clientes",  authMiddleware, require("./routes/clientes"));
app.use("/api/propostas", authMiddleware, require("./routes/propostas"));
app.use("/api/romaneios", authMiddleware, require("./routes/romaneios"));

// ─── Frontend estático ────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "../../frontend/dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/dist/index.html"));
});

// ─── Inicialização ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`OrcaPro rodando na porta ${PORT}`));