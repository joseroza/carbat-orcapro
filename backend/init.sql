-- ─── Extensões ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Usuários ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT        NOT NULL,
  login        TEXT        NOT NULL UNIQUE,
  senha_hash   TEXT        NOT NULL,
  perfil       TEXT        NOT NULL DEFAULT 'usuario',
  ativo        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO usuarios (nome, login, senha_hash, perfil)
VALUES ('Administrador', 'admin', crypt('carbat2024', gen_salt('bf', 10)), 'admin')
ON CONFLICT (login) DO NOTHING;

-- ─── Clientes ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social      TEXT        NOT NULL,
  nome_fantasia     TEXT,
  cnpj              TEXT,
  email             TEXT,
  telefone          TEXT,
  endereco          TEXT,
  cidade            TEXT,
  estado            TEXT,
  contato_principal TEXT,
  aprovado          BOOLEAN     DEFAULT NULL,
  created_date      TIMESTAMPTZ DEFAULT NOW(),
  updated_date      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Propostas ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS propostas (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  numero              TEXT,
  revisao             TEXT        DEFAULT '1.0',
  cliente_id          UUID        REFERENCES clientes(id) ON DELETE SET NULL,
  cliente_nome        TEXT,
  contato             TEXT,
  referencia          TEXT,
  titulo              TEXT        NOT NULL,
  tipo_fornecimento   TEXT,
  valor_total         NUMERIC     DEFAULT 0,
  status              TEXT        DEFAULT 'rascunho',
  data_proposta       DATE,
  validade_texto      TEXT,
  condicoes_pagamento TEXT,
  prazo_entrega       TEXT,
  observacoes         TEXT,
  reajuste            TEXT,
  impostos            TEXT,
  garantia            TEXT,
  escopo              TEXT,
  fora_escopo         TEXT,
  ensaios             TEXT,
  tratamento          TEXT,
  databook            TEXT,
  transporte          TEXT,
  documentos          TEXT,
  documentos_data     DATE,
  itens               JSONB       DEFAULT '[]',
  created_date        TIMESTAMPTZ DEFAULT NOW(),
  updated_date        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Romaneios ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS romaneios (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  numero           TEXT        NOT NULL,
  proposta_id      UUID        REFERENCES propostas(id) ON DELETE SET NULL,
  proposta_numero  TEXT,
  cliente_nome     TEXT,
  data_emissao     DATE,
  data_entrega     DATE,
  status           TEXT        DEFAULT 'pendente',
  endereco_entrega TEXT,
  observacoes      TEXT,
  itens            JSONB       DEFAULT '[]',
  created_date     TIMESTAMPTZ DEFAULT NOW(),
  updated_date     TIMESTAMPTZ DEFAULT NOW()
);