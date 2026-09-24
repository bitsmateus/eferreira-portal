-- AlterTable
ALTER TABLE "caso" ADD COLUMN     "empresaVinculadaId" TEXT;

-- CreateIndex
CREATE INDEX "caso_empresaVinculadaId_idx" ON "caso"("empresaVinculadaId");

-- AddForeignKey
ALTER TABLE "caso" ADD CONSTRAINT "caso_empresaVinculadaId_fkey" FOREIGN KEY ("empresaVinculadaId") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
