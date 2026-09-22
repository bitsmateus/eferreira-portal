-- CreateEnum
CREATE TYPE "CanalDePagamentoDosHonorariosFixos" AS ENUM ('PIX', 'TRANSFERENCIA', 'BOLETO');

-- AlterTable
ALTER TABLE "caso" ADD COLUMN     "canalDePagamentoFixo" "CanalDePagamentoDosHonorariosFixos";
