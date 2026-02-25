const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/clientes",  require("./routes/clientes"));
app.use("/api/propostas", require("./routes/propostas"));
app.use("/api/romaneios", require("./routes/romaneios"));

app.get("/api/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));
