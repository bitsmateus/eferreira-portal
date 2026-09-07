# Prompts para o Claude Code — Portal do Cliente E. Ferreira

Descompacte esta pasta, entre nela e abra o Claude Code:

```bash
cd eferreira-projeto
claude
```

Cole os prompts abaixo na ordem. Um por sessão.

---

## Prompt 0 — Sprint 0: fundação

```
Leia CLAUDE.md, docs/01-escopo-contratual.md e docs/02-roadmap.md.
Abra também docs/prototipo-e-ferreira.html e leia o HTML: ele é o protótipo
aprovado pelo cliente e define layout, terminologia e paleta.

Execute a Sprint 0 do roadmap. Ela precisa entregar:

- projeto Next.js 15 App Router + TypeScript strict, com noUncheckedIndexedAccess
- Tailwind configurado com a paleta grafite/prata extraída do protótipo,
  como tokens em tailwind.config.ts
- Prisma + PostgreSQL, com o modelo de dados completo: cliente (CPF/CNPJ como
  chave normalizada), caso, andamento, documento, usuario, auditoria
- Auth.js v5 com Credentials + Argon2id, bloqueio após 5 tentativas por 15 min
- os três perfis: OPERADOR, ADMINISTRADOR, CLIENTE
- a função central de autorização que filtra casos por sessão do servidor
- docker-compose com Postgres e MinIO para desenvolvimento local
- seed com um administrador e dados mínimos
- Vitest configurado, com testes de validação de CPF e CNPJ (dígito verificador)
- GitHub Actions rodando lint, tsc e testes

Não construa telas ainda além do login e de um painel vazio.

Ao final rode npm run test e npx tsc --noEmit. Os dois precisam passar.
Me diga o que ficou pronto e o que falhou.
```

---

## Prompt 1 — deixar rodando na máquina

```
Deixe o projeto rodando nesta máquina, do zero.

1. Confira node (precisa ser 22+), docker e git. Se faltar algo, pare e me diga
   o que instalar — não instale sozinho.
2. npm install
3. Copie .env.example para .env e gere o AUTH_SECRET com openssl rand -base64 32
4. npx prisma generate
5. docker compose up -d, depois prisma migrate dev e o seed
6. npm run dev em background e confirme que localhost:3000 responde

Critério de pronto: o login abre e entra. Me diga as credenciais do seed.
```

---

## Prompt 2 — repositório

```
Inicialize o git, confira que .env e node_modules estão no .gitignore, faça o
commit "Sprint 0 — fundação" e crie um repositório PRIVADO no GitHub chamado
eferreira-portal usando o gh CLI, com push.

Se o gh não estiver autenticado, pare e me diga o comando para eu autenticar.
Depois me diga o que configurar na proteção da branch main.
```

---

## Prompts 3 em diante — as sprints

Uma por sessão, trocando o número:

```
Leia CLAUDE.md e todos os arquivos de docs/, incluindo o protótipo HTML.
Execute a Sprint 1 do docs/02-roadmap.md, inteira.

Siga o protótipo para layout e terminologia. Ao final rode npm run test e
npx tsc --noEmit, faça o commit e abra um pull request.
```

**Sprint 4 tem uma exigência específica** — acrescente ao prompt dela:

```
O teste de isolamento é obrigatório e não pode ser simbólico: crie dois clientes
com casos distintos e prove, por teste automatizado, que nenhum enxerga nada do
outro, inclusive tentando acessar o caso alheio por id direto na URL.
```

---

## Revisão antes de cada merge

Abra uma **sessão nova** (contexto limpo) e cole:

```
Revise o diff da branch atual contra a main. Procure especificamente por:
violação das 12 regras do CLAUDE.md; autorização feita no cliente em vez do
servidor; consulta ao banco que não passa pelo filtro de autorização; CPF ou
CNPJ validado só por máscara; terminologia fora do padrão; escrita sem registro
de auditoria; arquivo servido por URL pública; e teste que passa sem testar nada.

Não conserte. Só me liste o que achou, do mais grave para o menos.
```

---

## O que só você pode fazer

| O quê | Por quê |
|---|---|
| Instalar Node 22, Docker e Git | precisa de sudo |
| Autenticar o `gh` no GitHub | login pelo navegador |
| Contratar/configurar o serviço no EasyPanel | painel externo |
| Cobrar as 4 dependências do escritório | são do cliente |

---

## Lembretes

- **Uma sprint por sessão.** Contexto longo degrada o código.
- **Nunca aceite merge com teste vermelho.**
- **A revisão em sessão limpa** enxerga o que a sessão que escreveu o código já
  não consegue ver.
- **Rode o teste de restauração do backup** antes de existir dado real.
