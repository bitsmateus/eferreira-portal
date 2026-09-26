-- CreateTable
CREATE TABLE "advogado" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "feminino" BOOLEAN NOT NULL DEFAULT false,
    "nacionalidade" TEXT NOT NULL,
    "estadoCivil" TEXT NOT NULL,
    "oab" TEXT NOT NULL,
    "oabUf" TEXT NOT NULL DEFAULT 'SP',
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advogado_pkey" PRIMARY KEY ("id")
);

-- Os dois advogados que já estavam no código (24/09/2026). Ids fixos, iguais
-- aos de antes ("sergio", "cristina"), para a auditoria dos documentos já
-- gerados continuar apontando para alguém que existe.
INSERT INTO "advogado" ("id", "nome", "feminino", "nacionalidade", "estadoCivil", "oab", "oabUf", "padrao", "ativo", "atualizadoEm")
VALUES
  ('sergio', 'Dr. Sergio Evangelista Ferreira', false, 'brasileiro', 'solteiro', '378.532', 'SP', true, true, CURRENT_TIMESTAMP),
  ('cristina', 'Dra. Cristina Moura Santos Lopes', true, 'brasileira', 'divorciada', '453.976', 'SP', false, true, CURRENT_TIMESTAMP);
