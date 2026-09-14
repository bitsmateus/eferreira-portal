-- AlterTable
ALTER TABLE "usuario" ALTER COLUMN "email" DROP NOT NULL;

-- CreateTable
CREATE TABLE "codigo_de_acesso" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "usadoEm" TIMESTAMP(3),
    "invalidadoEm" TIMESTAMP(3),
    "enderecoIp" TEXT,
    "agenteUsuario" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigo_de_acesso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "codigo_de_acesso_clienteId_criadoEm_idx" ON "codigo_de_acesso"("clienteId", "criadoEm");

-- AddForeignKey
ALTER TABLE "codigo_de_acesso" ADD CONSTRAINT "codigo_de_acesso_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
