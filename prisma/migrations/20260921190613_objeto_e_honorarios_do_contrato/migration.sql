-- CreateEnum
CREATE TYPE "TipoDeObjeto" AS ENUM ('CONSUMIDOR_PLANO_DE_SAUDE', 'TRABALHISTA', 'CIVEL', 'REVISIONAL', 'PERSONALIZADO');

-- CreateEnum
CREATE TYPE "NaturezaDoHonorarioPersonalizado" AS ENUM ('CUMULATIVA', 'SUBSTITUTIVA', 'COMPENSAVEL');

-- AlterTable
ALTER TABLE "caso" ADD COLUMN     "descricaoDoObjeto" TEXT,
ADD COLUMN     "honorariosPersonalizados" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "personalizadoBaseDeCalculo" TEXT,
ADD COLUMN     "personalizadoCondicaoDeExigibilidade" TEXT,
ADD COLUMN     "personalizadoCondicoesEspecificas" TEXT,
ADD COLUMN     "personalizadoNatureza" "NaturezaDoHonorarioPersonalizado",
ADD COLUMN     "personalizadoPagamento" TEXT,
ADD COLUMN     "personalizadoRelacaoComAsDemais" TEXT,
ADD COLUMN     "personalizadoServicos" TEXT,
ADD COLUMN     "personalizadoValorOuPercentual" TEXT,
ADD COLUMN     "prazoDePagamentoDaEconomia" INTEGER,
ADD COLUMN     "referenciaDaEconomia" TEXT,
ADD COLUMN     "tipoDeObjeto" "TipoDeObjeto";
