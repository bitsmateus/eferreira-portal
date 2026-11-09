-- CreateEnum
CREATE TYPE "SituacaoDaPublicacao" AS ENUM ('PENDENTE', 'CONFERIDA', 'DESCARTADA');

-- CreateTable
CREATE TABLE "publicacao" (
    "id" TEXT NOT NULL,
    "idDjen" TEXT NOT NULL,
    "hashDjen" TEXT,
    "disponibilizadaEm" TIMESTAMP(3) NOT NULL,
    "siglaTribunal" TEXT NOT NULL,
    "orgao" TEXT,
    "tipoComunicacao" TEXT,
    "tipoDocumento" TEXT,
    "classe" TEXT,
    "numeroProcesso" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "link" TEXT,
    "oabs" TEXT[],
    "casoId" TEXT,
    "situacao" "SituacaoDaPublicacao" NOT NULL DEFAULT 'PENDENTE',
    "analise" JSONB,
    "analisadaEm" TIMESTAMP(3),
    "analiseProvedor" TEXT,
    "analiseErro" TEXT,
    "prazoSugerido" TIMESTAMP(3),
    "conferidaEm" TIMESTAMP(3),
    "conferidaPorId" TEXT,
    "eventoId" TEXT,
    "andamentoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publicacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consulta_de_publicacoes" (
    "id" TEXT NOT NULL,
    "iniciadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminadaEm" TIMESTAMP(3),
    "inicioDaJanela" TEXT NOT NULL,
    "fimDaJanela" TEXT NOT NULL,
    "encontradas" INTEGER NOT NULL DEFAULT 0,
    "novas" INTEGER NOT NULL DEFAULT 0,
    "analisadas" INTEGER NOT NULL DEFAULT 0,
    "erro" TEXT,
    "disparadaPorId" TEXT,

    CONSTRAINT "consulta_de_publicacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "publicacao_idDjen_key" ON "publicacao"("idDjen");

-- CreateIndex
CREATE INDEX "publicacao_situacao_idx" ON "publicacao"("situacao");

-- CreateIndex
CREATE INDEX "publicacao_casoId_idx" ON "publicacao"("casoId");

-- CreateIndex
CREATE INDEX "publicacao_disponibilizadaEm_idx" ON "publicacao"("disponibilizadaEm");

-- CreateIndex
CREATE INDEX "publicacao_numeroProcesso_idx" ON "publicacao"("numeroProcesso");

-- CreateIndex
CREATE INDEX "consulta_de_publicacoes_iniciadaEm_idx" ON "consulta_de_publicacoes"("iniciadaEm");

-- AddForeignKey
ALTER TABLE "publicacao" ADD CONSTRAINT "publicacao_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "caso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicacao" ADD CONSTRAINT "publicacao_conferidaPorId_fkey" FOREIGN KEY ("conferidaPorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicacao" ADD CONSTRAINT "publicacao_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicacao" ADD CONSTRAINT "publicacao_andamentoId_fkey" FOREIGN KEY ("andamentoId") REFERENCES "andamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

