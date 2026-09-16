-- CreateTable
CREATE TABLE "token_de_redefinicao_de_senha" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "usadoEm" TIMESTAMP(3),
    "invalidadoEm" TIMESTAMP(3),
    "enderecoIp" TEXT,
    "agenteUsuario" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_de_redefinicao_de_senha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "token_de_redefinicao_de_senha_usuarioId_criadoEm_idx" ON "token_de_redefinicao_de_senha"("usuarioId", "criadoEm");

-- AddForeignKey
ALTER TABLE "token_de_redefinicao_de_senha" ADD CONSTRAINT "token_de_redefinicao_de_senha_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
