-- CreateEnum
CREATE TYPE "PermissaoApi" AS ENUM ('CONSULTAR', 'ESCREVER');

-- CreateTable
CREATE TABLE "credencial_api" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "prefixo" TEXT NOT NULL,
    "identificador" TEXT NOT NULL,
    "segredoHash" TEXT NOT NULL,
    "final" TEXT NOT NULL,
    "permissoes" "PermissaoApi"[],
    "revogadoEm" TIMESTAMP(3),
    "ultimoUsoEm" TIMESTAMP(3),
    "usuarioId" TEXT NOT NULL,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credencial_api_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credencial_api_identificador_key" ON "credencial_api"("identificador");

-- CreateIndex
CREATE UNIQUE INDEX "credencial_api_usuarioId_key" ON "credencial_api"("usuarioId");

-- CreateIndex
CREATE INDEX "credencial_api_revogadoEm_idx" ON "credencial_api"("revogadoEm");

-- AddForeignKey
ALTER TABLE "credencial_api" ADD CONSTRAINT "credencial_api_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credencial_api" ADD CONSTRAINT "credencial_api_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
