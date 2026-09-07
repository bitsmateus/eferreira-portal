# Implantação no EasyPanel — homologação e produção

> Sprint 0. Este documento é o roteiro; a execução no painel do EasyPanel é
> manual e depende de credenciais que só o fornecedor tem.

## Dois projetos separados

O roadmap pede projetos `producao` e `homologacao` **separados** — não dois
serviços no mesmo projeto. Separados significa: banco próprio, balde próprio,
variáveis próprias, e nenhuma chance de um `DATABASE_URL` de homologação
apontar para o banco de produção por engano.

| | `homologacao` | `producao` |
|---|---|---|
| Aplicação | `portal` | `portal` |
| Banco | Postgres 16 | Postgres 16 |
| Arquivos | MinIO (ou S3 do provedor) | MinIO (ou S3 do provedor) |
| Domínio | a definir | a definir (dependência 3.3) |

## Serviço da aplicação

- **Origem:** repositório GitHub `eferreira-portal`, branch `main`.
- **Build:** `npm ci && npm run build`
- **Subida:** `npx prisma migrate deploy && npm run start`

O `migrate deploy` na subida é a regra 7: migração versionada, aplicada pelo
deploy. Nunca `db push`, nunca SQL rodado à mão.

## Variáveis de ambiente

Todas marcadas como **secretas** no EasyPanel (regra 8). A lista está em
[`.env.example`](../.env.example). As que mudam entre ambientes:

| Variável | Observação |
|---|---|
| `DATABASE_URL` | O Postgres do próprio projeto |
| `AUTH_SECRET` | Diferente em cada ambiente. `openssl rand -base64 32` |
| `AUTH_URL` | O domínio do ambiente, com `https://` |
| `ARMAZENAMENTO_*` | Balde e credenciais do próprio ambiente |
| `BANCO_VIA_DOCKER` | `false` — `pg_dump` e `psql` rodam direto |

## Tráfego criptografado

Cláusula 5ª: TLS obrigatório. No EasyPanel, ativar o certificado no domínio e
deixar o redirecionamento de HTTP para HTTPS ligado. A aplicação já envia
`Strict-Transport-Security` (ver `next.config.ts`).

## Backup automático

1. Ativar o backup do serviço de Postgres no EasyPanel, diário, com retenção de
   pelo menos 30 dias.
2. Além dele, agendar `npm run banco:backup` com `PASTA_DE_BACKUP` apontando
   para um volume persistente — dois mecanismos independentes.
3. **Rodar `npm run banco:teste-restauracao` antes de existir dado real.** Já
   foi executado com sucesso no ambiente local; repetir em homologação e em
   produção na primeira subida de cada um. Backup que nunca foi restaurado é um
   arquivo, não um backup.

## Checklist da primeira subida

- [ ] Projeto `homologacao` criado, com Postgres e armazenamento próprios
- [ ] Variáveis cadastradas como secretas
- [ ] TLS ativo e redirecionamento de HTTP ligado
- [ ] `prisma migrate deploy` rodou na subida
- [ ] Semente executada; senhas anotadas em cofre, não em conversa
- [ ] Backup automático ativo
- [ ] **Teste de restauração executado com sucesso**
- [ ] Login abre e entra
- [ ] Mesma sequência repetida em `producao`

## O que só o fornecedor pode fazer

Contratar e configurar o serviço no EasyPanel, apontar o domínio e guardar as
credenciais. Nada disso sai deste repositório.
