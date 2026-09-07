# Portal do Cliente — E. Ferreira Advogados

Sistema de Cadastro de Clientes e Acompanhamento de Processos.
Cliente: **E. Ferreira Advogados**. Fornecedor: **NX Netscale Ltda**.

O escopo é o dos Anexos I e II do contrato, transcritos em
[`docs/01-escopo-contratual.md`](docs/01-escopo-contratual.md). As regras de
trabalho estão em [`CLAUDE.md`](CLAUDE.md). O plano por sprints está em
[`docs/02-roadmap.md`](docs/02-roadmap.md). O protótipo aprovado — que define
layout, terminologia e paleta — está em
[`docs/prototipo-e-ferreira.html`](docs/prototipo-e-ferreira.html).

---

## Rodar na sua máquina

Precisa de **Node 22+**, **Docker** e **Git**.

```bash
npm install

cp .env.example .env
# gere o segredo e cole em AUTH_SECRET:
openssl rand -base64 32

docker compose up -d          # Postgres + MinIO
npx prisma migrate dev        # aplica as migrações
npm run prisma:semear         # cria administrador e operador

npm run dev                   # http://localhost:3000
```

A semente imprime as senhas **uma vez só**, no terminal. Se preferir escolher
as suas, preencha `SEMENTE_ADMIN_SENHA` e `SEMENTE_OPERADOR_SENHA` no `.env`
antes de semear.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o servidor de desenvolvimento |
| `npm run build` | Gera o cliente do Prisma e compila para produção |
| `npm run test` | Vitest, uma vez |
| `npm run test:observar` | Vitest em modo observação |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Conferência de tipos |
| `npm run prisma:migrar` | Cria e aplica migração em desenvolvimento |
| `npm run prisma:implantar` | `migrate deploy` — é o que roda na subida |
| `npm run prisma:semear` | Semente mínima |
| `npm run banco:backup` | Dump em `backups/` |
| `npm run banco:teste-restauracao` | Restaura o dump em um banco descartável e confere |

## Estrutura

```
prisma/
  schema.prisma       modelo de dados completo
  migrations/         migrações versionadas (regra 7)
  seed.ts             administrador + operador, nada mais
scripts/
  banco.ts            pg_dump/psql, no container ou direto
  backup.ts           gera o dump
  teste-de-restauracao.ts   restaura e confere
src/
  auth.config.ts      configuração compartilhada com o middleware (edge)
  auth.ts             Auth.js v5 + Argon2id + bloqueio
  middleware.ts       primeira barreira de rota
  lib/
    autorizacao.ts    OS FILTROS. Todo acesso a dado passa por aqui.
    sessao.ts         única ponte entre o cookie e a autorização
    documento.ts      CPF e CNPJ com dígito verificador
    datas.ts          America/Sao_Paulo
    senha.ts          Argon2id
    bloqueio.ts       5 tentativas / 15 minutos
    auditoria.ts      quem fez, o quê, quando, sobre qual registro
    prisma.ts         cliente do Prisma
  componentes/
    marca.tsx         a marca — trocar aqui quando a logo definitiva chegar
  app/
    entrar/           tela de login do operador
    painel/           painel (vazio na Sprint 0)
testes/               Vitest
```

## Backup e restauração

`npm run banco:backup` grava um dump em `backups/` (pasta ignorada pelo git —
dump de banco de escritório de advocacia não entra em repositório).

`npm run banco:teste-restauracao` faz o que a Sprint 0 exige: gera o dump, cria
um banco descartável, restaura, **confere tabela por tabela que a contagem de
linhas bate** e derruba o banco descartável. Rodou com sucesso antes de existir
dado real, e roda de novo a cada PR no CI.

Em homologação e produção, defina `BANCO_VIA_DOCKER=false` para que `pg_dump` e
`psql` sejam chamados direto, sem passar por container.

## As duas barreiras de autorização

1. O **middleware** decide se a rota abre. É a primeira barreira e a mais fraca.
2. O **filtro de `src/lib/autorizacao.ts`** decide o que a consulta ao banco
   enxerga. É a que vale.

Critérios vindos da interface entram sob `AND` junto da restrição da sessão —
por construção eles só conseguem estreitar o resultado, nunca ampliá-lo. Um
`id` na URL não substitui a restrição; há teste automatizado para isso em
[`testes/autorizacao.teste.ts`](testes/autorizacao.teste.ts).

## O que está deliberadamente de fora

- **Lista de status de andamento.** A tabela `status_andamento` existe e nasce
  vazia. O conteúdo é dependência do escritório (Anexo II, item 3.5) e trava a
  Sprint 2. Não se inventa lista de status.
- **Dados de exemplo de cliente.** Os CPFs e CNPJs do protótipo são fictícios e
  reprovam no dígito verificador — o próprio sistema os recusaria. A semente
  cria só os dois usuários da equipe.
- **Logo definitiva.** `src/componentes/marca.tsx` traz o desenho do protótipo.
  A logo em vetor e as cores institucionais são dependência 3.2.
- **Tudo do Anexo II.** Captura automática nos tribunais, peticionamento,
  aplicativo nativo, módulo financeiro e migração de histórico estão fora do
  contrato — nem implementados, nem "preparados para".
