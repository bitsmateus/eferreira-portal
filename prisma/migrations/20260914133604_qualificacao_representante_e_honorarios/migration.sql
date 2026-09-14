-- AlterTable
ALTER TABLE "caso" ADD COLUMN     "honorariosEmCentavos" INTEGER;

-- AlterTable
ALTER TABLE "cliente" ADD COLUMN     "nomeMae" TEXT;

-- CreateTable
CREATE TABLE "representante_legal" (
    "id" TEXT NOT NULL,
    "pessoaJuridicaId" TEXT NOT NULL,
    "pessoaFisicaId" TEXT NOT NULL,
    "qualificacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "representante_legal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcela_de_honorarios" (
    "id" TEXT NOT NULL,
    "casoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "valorEmCentavos" INTEGER NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parcela_de_honorarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "representante_legal_pessoaFisicaId_idx" ON "representante_legal"("pessoaFisicaId");

-- CreateIndex
CREATE UNIQUE INDEX "representante_legal_pessoaJuridicaId_pessoaFisicaId_key" ON "representante_legal"("pessoaJuridicaId", "pessoaFisicaId");

-- CreateIndex
CREATE INDEX "parcela_de_honorarios_casoId_idx" ON "parcela_de_honorarios"("casoId");

-- CreateIndex
CREATE UNIQUE INDEX "parcela_de_honorarios_casoId_numero_key" ON "parcela_de_honorarios"("casoId", "numero");

-- AddForeignKey
ALTER TABLE "representante_legal" ADD CONSTRAINT "representante_legal_pessoaJuridicaId_fkey" FOREIGN KEY ("pessoaJuridicaId") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "representante_legal" ADD CONSTRAINT "representante_legal_pessoaFisicaId_fkey" FOREIGN KEY ("pessoaFisicaId") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcela_de_honorarios" ADD CONSTRAINT "parcela_de_honorarios_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "caso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
