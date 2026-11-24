-- Troca da D4Sign pela ZapSign (11/2026). Os envios que já existem são todos
-- da D4Sign: o DEFAULT preenche as linhas antigas com esse valor.

-- AlterEnum
ALTER TYPE "OrigemDoDocumento" ADD VALUE 'ASSINADO_NA_ZAPSIGN';

-- CreateEnum
CREATE TYPE "ProvedorAssinatura" AS ENUM ('D4SIGN', 'ZAPSIGN');

-- AlterTable
ALTER TABLE "envio_para_assinatura" ADD COLUMN     "provedor" "ProvedorAssinatura" NOT NULL DEFAULT 'D4SIGN';
