-- CreateEnum
CREATE TYPE "SituacaoCliente" AS ENUM ('ATIVO', 'INATIVO');

-- CreateEnum
CREATE TYPE "OrigemDoDocumento" AS ENUM ('GERADO', 'ANEXADO', 'ASSINADO_NA_D4SIGN');

-- AlterTable
ALTER TABLE "cliente" ADD COLUMN     "situacao" "SituacaoCliente" NOT NULL DEFAULT 'ATIVO';

-- AlterTable
ALTER TABLE "documento" ADD COLUMN     "origem" "OrigemDoDocumento" NOT NULL DEFAULT 'ANEXADO';

-- Backfill: melhor inferência possível para documento gravado ANTES desta
-- coluna existir (não é garantia perfeita — ver o comentário do enum em
-- schema.prisma). Tudo o que já é ANEXADO pelo padrão acima fica como está.

-- 1) Quem já é o alvo de um envio para assinatura é o PDF que voltou
--    assinado da D4Sign, não algo gerado nem anexado manualmente.
UPDATE "documento" AS d
SET "origem" = 'ASSINADO_NA_D4SIGN'
WHERE EXISTS (
  SELECT 1 FROM "envio_para_assinatura" AS e
  WHERE e."documentoAssinadoId" = d."id"
);

-- 2) Do resto, quem tem tipo diferente de ANEXO quase certamente foi gerado
--    pelo próprio sistema (contrato, procuração, declaração) — é o caminho
--    mais percorrido, e a exceção (papel digitalizado com esses tipos) é rara.
UPDATE "documento"
SET "origem" = 'GERADO'
WHERE "origem" = 'ANEXADO' AND "tipo" != 'ANEXO';
