-- CreateTable
CREATE TABLE "evento" (
    "id" TEXT NOT NULL,
    "casoId" TEXT NOT NULL,
    "responsavelId" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "prazoDeEntrega" TIMESTAMP(3) NOT NULL,
    "cumpridoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "criadoPorId" TEXT,

    CONSTRAINT "evento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evento_casoId_idx" ON "evento"("casoId");

-- CreateIndex
CREATE INDEX "evento_responsavelId_idx" ON "evento"("responsavelId");

-- CreateIndex
CREATE INDEX "evento_prazoDeEntrega_idx" ON "evento"("prazoDeEntrega");

-- AddForeignKey
ALTER TABLE "evento" ADD CONSTRAINT "evento_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "caso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento" ADD CONSTRAINT "evento_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento" ADD CONSTRAINT "evento_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
