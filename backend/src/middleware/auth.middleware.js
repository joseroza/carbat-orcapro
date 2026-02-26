const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "carbat_orcapro_secret_2024";

/**
 * Middleware que valida o token JWT em todas as requisições.
 * O token deve vir no header: Authorization: Bearer <token>
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não fornecido. Faça login para continuar." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.usuario = payload; // { id, nome, login, perfil }
    next();
  } catch (e) {
    return res.status(401).json({ error: "Token inválido ou expirado. Faça login novamente." });
  }
}

/**
 * Middleware que exige perfil admin.
 * Use após authMiddleware.
 */
function adminMiddleware(req, res, next) {
  if (req.usuario?.perfil !== "admin") {
    return res.status(403).json({ error: "Acesso restrito a administradores." });
  }
  next();
}

module.exports = { authMiddleware, adminMiddleware, JWT_SECRET };
