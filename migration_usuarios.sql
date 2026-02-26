-- Migration: tabela de usuários
-- Execute no banco antes de subir o backend atualizado

-- Habilita a extensão de criptografia do PostgreSQL
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  login TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  perfil TEXT NOT NULL DEFAULT 'usuario',  -- 'admin' ou 'usuario'
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Cria o usuário admin inicial
-- Login: admin  |  Senha: carbat2024
INSERT INTO usuarios (nome, login, senha_hash, perfil)
VALUES (
  'Administrador',
  'admin',
  crypt('carbat2024', gen_salt('bf', 10)),
  'admin'
)
ON CONFLICT (login) DO NOTHING;
