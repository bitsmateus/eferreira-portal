-- CreateEnum
CREATE TYPE "AreaDoCaso" AS ENUM ('TRABALHISTA', 'CONSUMIDOR', 'SAUDE', 'BANCARIO', 'TRANSITO', 'EXECUCOES', 'CIVEL_EMPRESARIAL', 'FAMILIA');

-- AlterTable
ALTER TABLE "caso" ADD COLUMN     "area" "AreaDoCaso";

-- AlterTable
ALTER TABLE "publicacao" ADD COLUMN     "minuta" TEXT,
ADD COLUMN     "minutaArea" "AreaDoCaso",
ADD COLUMN     "minutaBuscas" INTEGER,
ADD COLUMN     "minutaErro" TEXT,
ADD COLUMN     "minutaFontes" JSONB,
ADD COLUMN     "minutaGeradaEm" TIMESTAMP(3),
ADD COLUMN     "minutaNota" TEXT,
ADD COLUMN     "minutaPedidaEm" TIMESTAMP(3),
ADD COLUMN     "minutaPedidaPorId" TEXT,
ADD COLUMN     "minutaProvedor" TEXT;
