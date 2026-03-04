-- Adicionar coluna de permissões na tabela de usuários
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permissoes JSONB DEFAULT '{
  "propostas_ver": true,
  "propostas_criar": false,
  "propostas_editar": false,
  "propostas_excluir": false,
  "propostas_exportar": true,
  "propostas_revisao": false,
  "clientes_ver": true,
  "clientes_criar": false,
  "clientes_editar": false,
  "clientes_excluir": false,
  "romaneios_ver": true,
  "romaneios_criar": false,
  "romaneios_editar": false,
  "romaneios_excluir": false
}'::jsonb;
