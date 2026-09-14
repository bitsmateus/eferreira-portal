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

---

## O que foi feito de verdade — 14/09/2026

Os dois projetos existem e **produção está no ar**: `https://portal.eferreira.adv.br`,
com certificado, migrações aplicadas, administrador semeado e entrada no painel
conferida de ponta a ponta.

| | `eferreira-producao` | `eferreira-homologacao` |
|---|---|---|
| Postgres 16 | no ar | no ar |
| MinIO | no ar | no ar |
| Balde `eferreira-documentos` | criado, privado | criado, privado |
| Aplicação | **no ar** | construída, sem domínio |
| Domínio | `portal.eferreira.adv.br` | falta registro de DNS |

O servidor hospeda outro cliente, no projeto `consensus`. Não se encosta nele.

### Quatro armadilhas que custaram deploy

**1. A imagem do MinIO.** `minio/minio` no Docker Hub responde *"pull access
denied for minio/minio"*. A que funciona é **`quay.io/minio/minio:latest`**, o
registro oficial. O `docker-compose.yml` de desenvolvimento ainda aponta para a
do Docker Hub e só funciona por já estar em cache local — quem montar um
ambiente novo tropeça nisso.

**2. A porta.** O EasyPanel roda aplicação na **porta 80** por padrão, e o
`next start` obedece à variável `PORT`. Ou o domínio aponta para 80, ou se
define `PORT=3000`. Escolhido o segundo, que é o que o `Dockerfile` expõe. Sem
isso, o domínio responde 502 com a aplicação saudável por trás — o pior tipo de
erro para diagnosticar.

**3. O primeiro administrador.** A semente entrou no `CMD` do contêiner, depois
de `migrate deploy`. Ela é idempotente e roda em toda subida: instalação nova
nasce com administrador sem depender de alguém abrir um terminal no painel.
As senhas vêm de `SEMENTE_ADMIN_SENHA` e `SEMENTE_OPERADOR_SENHA`.

**4. O Chromium.** `npx playwright install --with-deps chromium` na imagem leva
uns dois minutos e baixa cem e poucos megabytes de bibliotecas de sistema. É
essa etapa que evita a falha de "libnss3.so não encontrado" que só apareceria
na primeira tentativa de gerar um documento, em produção.

### Onde ficam as senhas

**Só no EasyPanel.** Postgres, MinIO, `AUTH_SECRET` e as senhas da semente foram
geradas na implantação e nunca passaram pelo repositório. Para ver qualquer uma:
projeto → serviço → **Environment**.

O primeiro acesso ao painel é `admin@eferreira.adv.br`, com a senha em
`SEMENTE_ADMIN_SENHA` do serviço `portal`.

### O que falta

1. **`SMTP_SENHA`** — a senha de app do Gmail. Sem ela nenhum cliente entra no
   portal. Conferir com `npm run email:teste`.
2. **DNS de homologação** — um registro A para `homologacao.eferreira.adv.br`
   apontando para o mesmo IP.
3. **Backup do Postgres** no EasyPanel, e o teste de restauração em produção
   antes de existir dado real.
