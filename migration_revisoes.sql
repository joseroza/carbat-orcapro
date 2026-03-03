-- ─── Histórico de Revisões de Propostas ──────────────────────────────────────
-- Executar no banco para adicionar suporte a histórico de revisões.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proposta_revisoes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id  UUID        NOT NULL REFERENCES propostas(id) ON DELETE CASCADE,
  revisao      TEXT        NOT NULL,       -- ex: "0.0", "1.0", "2.0"
  snapshot     JSONB       NOT NULL,       -- cópia completa dos dados da proposta
  criado_por   TEXT,                       -- nome do usuário que gerou a revisão
  created_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposta_revisoes_proposta_id
  ON proposta_revisoes (proposta_id);

-- Garantir que propostas novas nasçam com revisão 0.0
ALTER TABLE propostas ALTER COLUMN revisao SET DEFAULT '0.0';
