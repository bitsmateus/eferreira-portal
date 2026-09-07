-- Busca por nome sem acento (Anexo I, 2.1).
--
-- "Marcos Vinicius" precisa encontrar "Marcos Vinícius Andrade". O ILIKE do
-- Postgres é sensível a acento, e comparar sem acento exigiria a extensão
-- `unaccent` e consulta em SQL cru — que escaparia do filtro de autorização.
-- Por isso a forma normalizada mora em coluna própria, escrita pela aplicação
-- (ver normalizarParaBusca em src/lib/formatos.ts).
--
-- A coluna nasce anulável, é preenchida a partir do que já existe e só então
-- vira obrigatória: assim a migração roda em base com dado, não só em base
-- vazia.

-- DropIndex
DROP INDEX "cliente_nome_idx";

-- AlterTable: primeiro anulável, para poder preencher.
ALTER TABLE "cliente" ADD COLUMN "nomeBusca" TEXT;

-- Preenchimento dos registros existentes. O `translate` cobre os acentos do
-- português; daqui em diante quem normaliza é a aplicação, em um lugar só.
UPDATE "cliente"
SET "nomeBusca" = translate(
  lower("nome"),
  'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
  'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
)
WHERE "nomeBusca" IS NULL;

-- Agora sim, obrigatória.
ALTER TABLE "cliente" ALTER COLUMN "nomeBusca" SET NOT NULL;

-- CreateIndex
CREATE INDEX "cliente_nomeBusca_idx" ON "cliente"("nomeBusca");
