const express = require("express");
const cors = require("cors");
const path = require("path");
const app = express();

app.use(cors());
app.use(express.json());

// ─── Rotas da API ─────────────────────────────────────────────────────────────
app.use("/api/clientes",  require("./routes/clientes"));
app.use("/api/propostas", require("./routes/propostas"));
app.use("/api/romaneios", require("./routes/romaneios"));

app.get("/api/health", (req, res) => res.json({ ok: true }));

// ─── Frontend estático (produção) ─────────────────────────────────────────────
// Serve os arquivos gerados pelo "npm run build" dentro de frontend/dist
app.use(express.static(path.join(__dirname, "../../frontend/dist")));

// Qualquer rota que não seja /api/* retorna o index.html
// Necessário para o React Router funcionar corretamente
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/dist/index.html"));
});

// ─── Inicialização ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`OrcaPro rodando na porta ${PORT}`));
