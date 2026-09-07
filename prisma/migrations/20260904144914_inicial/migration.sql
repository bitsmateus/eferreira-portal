-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('OPERADOR', 'ADMINISTRADOR', 'CLIENTE');

-- CreateEnum
CREATE TYPE "SituacaoUsuario" AS ENUM ('ATIVO', 'CONVITE_PENDENTE', 'INATIVO');

-- CreateEnum
CREATE TYPE "TipoPessoa" AS ENUM ('FISICA', 'JURIDICA');

-- CreateEnum
CREATE TYPE "SituacaoCaso" AS ENUM ('EM_ANDAMENTO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('CONTRATO', 'PROCURACAO', 'DECLARACAO', 'ANEXO');

-- CreateEnum
CREATE TYPE "AcaoAuditoria" AS ENUM ('CRIACAO', 'ATUALIZACAO', 'EXCLUSAO', 'ACESSO', 'AUTENTICACAO');

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT,
    "perfil" "PerfilUsuario" NOT NULL,
    "situacao" "SituacaoUsuario" NOT NULL DEFAULT 'ATIVO',
    "tentativasFalhas" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoAte" TIMESTAMP(3),
    "ultimoAcessoEm" TIMESTAMP(3),
    "clienteId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente" (
    "id" TEXT NOT NULL,
    "tipoPessoa" "TipoPessoa" NOT NULL,
    "documento" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "rg" TEXT,
    "dataNascimento" TIMESTAMP(3),
    "estadoCivil" TEXT,
    "profissao" TEXT,
    "nacionalidade" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "cep" TEXT,
    "endereco" TEXT,
    "contratoAssinadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "criadoPorId" TEXT,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caso" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "numeroProcesso" TEXT,
    "assunto" TEXT NOT NULL,
    "vara" TEXT,
    "parteContraria" TEXT,
    "situacao" "SituacaoCaso" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "responsavelId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_andamento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "status_andamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "andamento" (
    "id" TEXT NOT NULL,
    "casoId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "statusId" TEXT,
    "descricao" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "andamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "casoId" TEXT,
    "tipo" "TipoDocumento" NOT NULL,
    "nome" TEXT NOT NULL,
    "chaveArquivo" TEXT NOT NULL,
    "tipoConteudo" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "assinadoEm" TIMESTAMP(3),
    "enviadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "usuarioEmail" TEXT,
    "acao" "AcaoAuditoria" NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "detalhes" JSONB,
    "enderecoIp" TEXT,
    "agenteUsuario" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "usuario_perfil_idx" ON "usuario"("perfil");

-- CreateIndex
CREATE INDEX "usuario_clienteId_idx" ON "usuario"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_documento_key" ON "cliente"("documento");

-- CreateIndex
CREATE INDEX "cliente_nome_idx" ON "cliente"("nome");

-- CreateIndex
CREATE INDEX "cliente_contratoAssinadoEm_idx" ON "cliente"("contratoAssinadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "caso_numeroProcesso_key" ON "caso"("numeroProcesso");

-- CreateIndex
CREATE INDEX "caso_clienteId_idx" ON "caso"("clienteId");

-- CreateIndex
CREATE INDEX "caso_situacao_idx" ON "caso"("situacao");

-- CreateIndex
CREATE UNIQUE INDEX "status_andamento_nome_key" ON "status_andamento"("nome");

-- CreateIndex
CREATE INDEX "andamento_casoId_data_idx" ON "andamento"("casoId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "documento_chaveArquivo_key" ON "documento"("chaveArquivo");

-- CreateIndex
CREATE INDEX "documento_clienteId_idx" ON "documento"("clienteId");

-- CreateIndex
CREATE INDEX "documento_casoId_idx" ON "documento"("casoId");

-- CreateIndex
CREATE INDEX "auditoria_entidade_entidadeId_idx" ON "auditoria"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "auditoria_usuarioId_idx" ON "auditoria"("usuarioId");

-- CreateIndex
CREATE INDEX "auditoria_criadoEm_idx" ON "auditoria"("criadoEm");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caso" ADD CONSTRAINT "caso_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caso" ADD CONSTRAINT "caso_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "andamento" ADD CONSTRAINT "andamento_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "caso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "andamento" ADD CONSTRAINT "andamento_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "status_andamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "andamento" ADD CONSTRAINT "andamento_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "caso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_enviadoPorId_fkey" FOREIGN KEY ("enviadoPorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
