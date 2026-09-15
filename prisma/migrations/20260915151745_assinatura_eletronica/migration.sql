-- CreateEnum
CREATE TYPE "SituacaoDoEnvio" AS ENUM ('NO_COFRE', 'AGUARDANDO', 'ASSINADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "envio_para_assinatura" (
    "id" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "uuidDocumento" TEXT NOT NULL,
    "cofre" TEXT NOT NULL,
    "situacao" "SituacaoDoEnvio" NOT NULL DEFAULT 'NO_COFRE',
    "situacaoNaD4Sign" TEXT,
    "signatarios" JSONB NOT NULL,
    "enviadoEm" TIMESTAMP(3),
    "conferidoEm" TIMESTAMP(3),
    "assinadoEm" TIMESTAMP(3),
    "documentoAssinadoId" TEXT,
    "pedidoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "envio_para_assinatura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "envio_para_assinatura_uuidDocumento_key" ON "envio_para_assinatura"("uuidDocumento");

-- CreateIndex
CREATE UNIQUE INDEX "envio_para_assinatura_documentoAssinadoId_key" ON "envio_para_assinatura"("documentoAssinadoId");

-- CreateIndex
CREATE INDEX "envio_para_assinatura_documentoId_idx" ON "envio_para_assinatura"("documentoId");

-- CreateIndex
CREATE INDEX "envio_para_assinatura_situacao_idx" ON "envio_para_assinatura"("situacao");

-- AddForeignKey
ALTER TABLE "envio_para_assinatura" ADD CONSTRAINT "envio_para_assinatura_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "documento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envio_para_assinatura" ADD CONSTRAINT "envio_para_assinatura_documentoAssinadoId_fkey" FOREIGN KEY ("documentoAssinadoId") REFERENCES "documento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envio_para_assinatura" ADD CONSTRAINT "envio_para_assinatura_pedidoPorId_fkey" FOREIGN KEY ("pedidoPorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
