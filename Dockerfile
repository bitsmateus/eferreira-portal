# Imagem da aplicação — Portal do Cliente, E. Ferreira Advogados.
#
# Duas coisas mandam no desenho deste arquivo:
#
#   1. O PDF é gerado com Playwright (Chromium). Nenhum construtor automático
#      instala navegador, então a imagem instala — e instala a versão que o
#      `package.json` fixou, com `npx playwright install`, em vez de uma imagem
#      pronta com versão própria que um dia diverge da do projeto.
#
#   2. Regra 7: o deploy aplica `prisma migrate deploy` na subida. Nunca
#      `db push`, nunca SQL rodado à mão. Por isso o Prisma CLI continua na
#      imagem final.

# ---------------------------------------------------------------------------
# Construção
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS construcao

WORKDIR /app

# O Prisma precisa do OpenSSL para escolher o motor certo; sem ele o
# `prisma generate` avisa e escolhe errado em tempo de execução.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# As dependências primeiro, sozinhas: assim uma mudança de código não invalida
# a camada de `npm ci`, que é a demorada.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# `next build` roda `prisma generate` pelo próprio script de build.
RUN npm run build

# ---------------------------------------------------------------------------
# Execução
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Fora do diretório do usuário, para o navegador sobreviver a qualquer troca
# de HOME dentro do contêiner.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=construcao /app ./

# O Chromium e as bibliotecas de sistema que ele exige. `--with-deps` é o que
# evita a falha clássica de "libnss3.so: cannot open shared object file" que só
# aparece na primeira tentativa de gerar um documento, em produção.
RUN npx playwright install --with-deps chromium

EXPOSE 3000

# Migração e semente antes de servir.
#
# Se a migração falhar, o contêiner não sobe — que é o comportamento certo:
# aplicação nova com banco velho corrompe dado.
#
# A semente roda em toda subida porque ela é idempotente: confere se o usuário
# já existe e, se existir, não toca nele. Rodar sempre é o que garante que uma
# instalação nova já nasce com administrador — sem depender de alguém lembrar
# de abrir um terminal no painel. As senhas vêm das variáveis SEMENTE_*; sem
# elas, a semente sorteia e imprime no log da primeira subida.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run prisma:semear && npm run start"]
