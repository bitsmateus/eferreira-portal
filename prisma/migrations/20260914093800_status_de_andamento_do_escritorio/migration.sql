-- Lista de status de andamento — Anexo II, item 3.5.
--
-- A tabela `status_andamento` nasceu vazia na migração inicial, de propósito:
-- status de andamento é vocabulário do escritório e não se inventa. A lista
-- chegou em 14/09/2026, por escrito, e é esta. Os nomes estão exatamente como
-- o escritório os escreveu.
--
-- O escritório também informou que o fluxo de acordo (polo passivo) está FORA
-- do escopo, então só existe esta lista. E que o cliente, na consulta, lê a
-- mensagem resumo do andamento — não há status interno, por isso não há
-- coluna de visibilidade.
--
-- Entra como migração, e não como semente, para que homologação e produção
-- recebam a mesma lista que o desenvolvimento (regra 7).
--
-- O id é um apelido estável em vez de um cuid: a lista é configurável pelo
-- escritório, mas estes cinco vêm do contrato e precisam ser reconhecíveis.
-- `ON CONFLICT DO NOTHING` torna a migração repetível sem duplicar.

INSERT INTO "status_andamento" ("id", "nome", "ordem", "ativo", "criadoEm", "atualizadoEm")
VALUES
  ('processo-distribuido',        'Processo Distribuído',       1, true, now(), now()),
  ('processo-aguardando-decisao', 'Processo Aguardando Decisão', 2, true, now(), now()),
  ('decisao-intermediaria',       'Decisão Intermediária',       3, true, now(), now()),
  ('sentenca',                    'Sentença',                    4, true, now(), now()),
  ('processo-em-recurso',         'Processo em Recurso',         5, true, now(), now())
ON CONFLICT ("nome") DO NOTHING;
