-- Migration: adiciona coluna aprovado na tabela clientes
-- Execute este script no banco de dados existente

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS aprovado BOOLEAN DEFAULT NULL;
