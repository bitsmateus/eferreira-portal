-- CreateEnum
CREATE TYPE "PapelDaParte" AS ENUM ('ADVOGADO', 'PARTE_CONTRARIA', 'TESTEMUNHA', 'OUTROS');

-- CreateTable
CREATE TABLE "parte" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "papel" "PapelDaParte" NOT NULL,
    "observacoes" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parte_papel_idx" ON "parte"("papel");

-- CreateIndex
CREATE INDEX "parte_nome_idx" ON "parte"("nome");

-- AddForeignKey
ALTER TABLE "parte" ADD CONSTRAINT "parte_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
