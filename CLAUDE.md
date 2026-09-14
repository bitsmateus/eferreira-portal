# Portal do Cliente — E. Ferreira Advogados

Sistema de Cadastro de Clientes e Acompanhamento de Processos.
Cliente: **E. Ferreira Advogados**. Fornecedor: **NX Netscale Ltda**.

Leia `docs/01-escopo-contratual.md` antes de escrever qualquer linha. Ele é a
transcrição dos Anexos I e II do contrato assinado — o que está lá é obrigação,
o que não está não se implementa.

---

## As 12 regras inegociáveis

1. **Tudo em português.** Nomes de tabelas, colunas, variáveis, rotas, arquivos,
   componentes, mensagens de erro e commits. `cliente`, `caso`, `andamento`,
   `documento` — nunca `client`, `case`, `update`.

2. **Autorização sempre no servidor.** Nenhuma decisão de acesso pode depender do
   que o navegador manda. Toda consulta ao banco passa por um filtro construído a
   partir da sessão do servidor, nunca por um `id` recebido do cliente.

3. **Isolamento por cliente é o requisito número um.** Um cliente enxerga
   exclusivamente os próprios casos, e apenas **depois que o contrato foi
   assinado** (Anexo I, 1.d). Antes disso ele não entra. Um cliente ver o caso de
   outro não é bug de interface: é incidente de LGPD envolvendo dado de processo
   de terceiro. Existe teste automatizado dedicado a isso e ele nunca é
   flexibilizado.

4. **CPF ou CNPJ é a chave de identificação em todo o sistema** (Anexo I, 1.e e
   2.1). Validação com **dígito verificador**, não apenas máscara. Armazenar
   sempre normalizado (só dígitos) e exibir formatado. Ao digitar um documento já
   cadastrado, o sistema **reconhece e traz o cliente existente** com seus casos,
   em vez de permitir cadastro duplicado.

5. **Nenhum arquivo é público.** Todo documento é servido por URL pré-assinada de
   validade curta, gerada após a verificação de autorização. Nunca há caminho
   adivinhável para um PDF.

6. **Auditoria obrigatória.** Toda escrita registra quem fez, o quê, quando e
   sobre qual registro. Andamento lançado sem autor identificado é andamento
   inútil como prova de diligência.

7. **Migrações versionadas.** Nada de `db push` nem SQL rodado à mão em produção.
   O deploy aplica `prisma migrate deploy` na subida.

8. **Nenhum segredo no repositório.** Credenciais só em variáveis de ambiente,
   marcadas como secretas no EasyPanel. `.env` fica no `.gitignore`.

9. **Testes são parte da entrega.** Cada sprint termina com `npm run test` e
   `npx tsc --noEmit` verdes. Sem exceção, sem "depois eu arrumo".

10. **Documentos saem dos modelos oficiais do escritório.** Contrato, procuração
    e declaração são gerados a partir dos modelos fornecidos pela E. Ferreira,
    com a logo no cabeçalho e no rodapé. Não invente cláusula, não reescreva
    texto jurídico, não "melhore" a redação.

11. **Datas em `America/Sao_Paulo`.** Sempre. Guardar em UTC, exibir e calcular no
    fuso de São Paulo.

12. **O Anexo II é uma fronteira.** Captura automática de movimentações nos
    tribunais, peticionamento, aplicativo nativo, módulo financeiro e migração de
    histórico estão **fora do contrato**. Não implemente nada disso, nem
    "preparado para", nem "só a estrutura". Se parecer necessário, pare e avise.

---

## Decisões já tomadas

| Tema | Decisão | Origem |
|---|---|---|
| Tema visual | Claro, com grafite e prata nos acentos | Aprovado com o fornecedor |
| Assinatura | Plataforma de assinatura eletrônica externa | Anexo II, item 3.4 — resolvido |
| Acesso do cliente | CPF ou CNPJ + código enviado por e-mail | Anexo II, item 3.6 — resolvido |
| Nome do produto | "Portal do Cliente — E. Ferreira" na área externa | Aprovado |

O protótipo aprovado está em `docs/prototipo-e-ferreira.html`. Abra no navegador
antes de implementar qualquer tela: ele define layout, hierarquia, terminologia e
paleta. **Siga o protótipo.** Se algo nele conflitar com o escopo, o escopo vence
e você avisa.

---

## Terminologia obrigatória

| Use | Nunca use |
|---|---|
| Cliente | Usuário externo, parte |
| Caso | Processo (o *caso* é o registro interno; *número do processo* é um campo dele) |
| Andamento | Movimentação, atualização, evento |
| Operador | Colaborador, funcionário, atendente |
| Administrador | Admin, superusuário, gestor |
| Pasta do cliente | Repositório, drive, arquivos |

---

## Stack

| Camada | Escolha |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript **strict**, com `noUncheckedIndexedAccess` |
| UI | Tailwind CSS |
| Banco | PostgreSQL |
| ORM | Prisma, migrações versionadas |
| Autenticação | Auth.js (NextAuth v5) + Argon2id |
| Arquivos | Object storage S3-compatível (MinIO em desenvolvimento) |
| PDFs | Playwright (HTML → PDF), reaproveitando o CSS dos documentos |
| Testes | Vitest (unitário) + Playwright (ponta a ponta) |
| CI | GitHub Actions em cada PR |
| Hospedagem | EasyPanel, projetos `producao` e `homologacao` separados |

Princípio: nada proprietário. Postgres, S3 e Node são padrões abertos. Trocar de
fornecedor ou de nuvem tem que ser mudança de configuração, não reescrita.

---

## Perfis de acesso

- **Operador** — executa todo o fluxo: cadastra clientes e casos, lança
  andamentos, gera e envia documentos.
- **Administrador** — tudo do operador, mais gestão de usuários e das credenciais
  da API.
- **Cliente** — consulta apenas os próprios casos, após a assinatura do contrato.

---

## Como trabalhar

- Uma sprint por sessão. Leia `docs/02-roadmap.md` e execute a sprint pedida,
  inteira, sem começar a seguinte.
- Ao final: rode os testes, rode o `tsc`, faça o commit e abra o PR.
- Se faltar informação do cliente (modelo de documento, lista de status, logo),
  **pare e avise** — não invente conteúdo para destravar.

## Pendências com o escritório

Situação em **14/09/2026**. Cobrança enviada em 09/09, respondida em parte.

**3.6 — RESPONDIDA, com pendência nova.** O escritório tem serviço de e-mail
por **SMTP** próprio, e a entrada do cliente já está de pé sobre ele. Faltam as
credenciais: servidor, porta, usuário, senha e qual endereço vai como
remetente. Sem elas o sistema não manda o código e **nenhum cliente entra**.
Em desenvolvimento o código é impresso no terminal. Ver
`docs/area-do-cliente.md`.

**3.5 — RESPONDIDA.** A lista de status está cadastrada por migração
(`20260914093800`). O escritório confirmou que o fluxo de acordo (polo passivo)
está **fora do escopo**, que um caso **não muda de polo**, e que o cliente lê
**a mensagem resumo** do andamento — por isso não há status interno nem coluna
de visibilidade. Campos obrigatórios definidos, **sem** data de nascimento, e
com bloqueio de gravação ("melhor não deixar salvar, para não criar futuras
pendências").

**3.1 — RESPONDIDA.** Os modelos viraram HTML em branco com marcadores em
`src/modelos/`, e o sistema já gera procuração, declaração e contrato em PDF.
O termo de acordo ficou fora do escopo, por decisão do escritório. Ver
`docs/modelos-de-documento.md`.

**3.3 — parcial.** Domínio `eferreira.adv.br` na Locaweb; falta definir o
subdomínio e o acesso ao DNS. Assinatura pelo **D4Sign**, mas veio a senha de
login em vez do **token de API** — que é o que a integração usa. A senha foi
exposta em texto puro no WhatsApp e o escritório foi orientado a trocá-la.

**3.2 — logo em vetor: não veio.** Trava a Sprint 5 e os documentos gerados.

### O que ainda falta perguntar

1. **A cláusula 9ª aparece duas vezes** no contrato do escritório
   ("Autorização para recebimento" e "Foro"). Transcrito como está — regra 10
   proíbe reescrever texto jurídico. Precisa de correção deles.
2. **Dois endereços profissionais diferentes** nos modelos. Adotado o do
   contrato; ver `src/lib/escritorio.ts`.
3. **Token de API do D4Sign**, para enviar à assinatura. A senha de login que
   mandaram não serve para integração.
4. **Subdomínio do portal** e acesso ao DNS na Locaweb.
5. **Logo em vetor** (3.2): sem ela, o cabeçalho dos documentos sai em texto.
6. **Credenciais do SMTP** (3.6): servidor, porta, usuário, senha e remetente.
   É por elas que o código de acesso do cliente sai.
7. **A tela de entrada do cliente não mostra o e-mail mascarado** que o
   protótipo desenhou — mostrar responderia, a qualquer um, se um CPF é
   cliente do escritório. Diferença visível; combinar na demonstração. Ver
   `docs/area-do-cliente.md`.

**Enquanto não responderem: não invente conteúdo para destravar.**

## Estado atual

**Sprint 4 concluída** (14/09/2026). **A área do cliente está de pé.** O
cliente entra em `/consultar` com CPF ou CNPJ e um código de seis dígitos
enviado ao e-mail do cadastro, e vê em `/meus-processos` os próprios casos, o
histórico de andamentos e os próprios documentos — nada mais.

O **gatilho do Anexo I, 1.d** finalmente tem onde ser acionado: o cartão
"Acesso do cliente", na ficha, registra a data da assinatura do contrato e é
isso que libera a entrada. Tem o inverso também — revogar apaga a data,
desativa o usuário e mata os códigos pendentes na hora. Cadastro sem e-mail não
vira acesso liberado. Até o D4Sign chegar, quem informa a data é o operador.

**233 testes.** Os 18 do isolamento rodam contra o Postgres de verdade
(`npm run test:banco`, e no CI depois do `migrate deploy`): dois clientes com
caso, andamento e documento próprios, e nenhum enxerga nada do outro — nem
colando o id alheio na URL. É o critério de pronto da sprint, e a regra 3 diz
que ele não é flexibilizado.

A resposta do pedido de código é **sempre a mesma**, exista o cliente ou não:
distinguir responderia, a qualquer um, se um CPF é cliente deste escritório.
Pelo mesmo motivo a tela **não** mostra o e-mail mascarado do protótipo — a
única divergência deliberada, registrada em `docs/area-do-cliente.md`.

**Implantação:** sem as variáveis `SMTP_*` o sistema não manda o código e o
cliente não entra. Em desenvolvimento o e-mail sai no terminal.

**Sprint 3 — geração de documentos feita** (14/09/2026). Procuração, declaração
e contrato saem em PDF a partir dos modelos do escritório, com prévia na tela
montada pela **mesma função** que gera o arquivo. Documento com cadastro
incompleto não é gerado: a tela diz o que falta e leva ao lugar de preencher.
O PDF é arquivado na pasta do cliente e sai pela mesma porta autorizada dos
demais. **Falta a assinatura eletrônica**, que depende do token do D4Sign.

Cadastro ganhou o que os documentos exigem: nome da mãe, campos obrigatórios
que bloqueiam a gravação, representante legal de pessoa jurídica, e honorários
com parcelas (sem nada de pagamento — regra 12). 202 testes.

**Implantação:** o servidor precisa de `npx playwright install --with-deps
chromium`. Sem o navegador, a geração falha em execução, mas o build passa.

**Sprint 2 concluída** (14/09/2026). Os **andamentos** entraram: lançamento com
data, situação e o texto que o cliente lê, linha do tempo no caso e no painel,
autor identificado em cada lançamento. A lista de situações vem do banco
(migração `20260914093800`), não do código — o escritório pode mudá-la sem nova
versão. Data futura é recusada: andamento registra o que já aconteceu.
144 testes. O isolamento entre clientes foi verificado contra o banco real,
incluindo tentativa de ler andamento alheio por id direto.

**A pasta única do cliente** (07/09/2026) está de
pé: anexo pelo painel, visualização e download, tudo reunido por cliente e
também filtrado por caso. Nenhum arquivo é público — a chave no armazenamento é
sorteada pelo servidor e o arquivo só sai por URL assinada de validade curta,
gerada depois da verificação de autorização; envio e leitura ficam na auditoria.
Verificado contra o MinIO real, inclusive que o balde recusa a leitura sem
assinatura. 132 testes.

**A outra metade — os andamentos — está parada na dependência 3.5.** Ver a
seção de pendências acima.

**Sprint 1 concluída** (07/09/2026). Cadastro de cliente com validação real de
CPF e CNPJ, busca por nome/CPF/CNPJ, caso vinculado com número do processo e o
reconhecimento automático do documento já cadastrado. Telas: lista e ficha do
cliente, novo cliente, edição, novo caso, lista e ficha do caso, painel com
indicadores. 112 testes verdes.

Duas coisas ficaram registradas aqui porque afetam quem for adiante:

- **Os CPFs do protótipo são inválidos.** Todos os quatro reprovam no dígito
  verificador, e o CNPJ `18.442.907/0001-55` também. Nunca os use na semente,
  na demonstração ou no roteiro de aceite — o sistema os recusa, corretamente.
- **O formulário não tem o seletor "Tipo" do protótipo.** O tipo de pessoa é
  derivado do próprio documento (11 dígitos = física, 14 = jurídica), porque
  regra 2 proíbe decidir isso pelo que o navegador manda. Confirmar com o
  escritório na demonstração.

**Sprint 0 concluída** (04/09/2026), exceto a publicação em homologação, que
depende do painel do EasyPanel e do domínio (dependência 3.3).

De pé: Next.js 15 + TypeScript strict com `noUncheckedIndexedAccess`, Tailwind
com a paleta do protótipo, Prisma com o modelo completo e a migração `inicial`
versionada, Auth.js v5 com Argon2id e bloqueio de 5 tentativas por 15 minutos,
os três perfis, os filtros de autorização em `src/lib/autorizacao.ts`,
docker-compose com Postgres e MinIO, semente com administrador e operador,
Vitest com 76 testes e GitHub Actions rodando lint, tipos, testes, migrações e
o teste de restauração. Telas: só login e painel vazio.

Teste de restauração do backup: **executado com sucesso**, antes de existir
dado real (`npm run banco:teste-restauracao`).

Próximo passo: a Sprint 5 — logo e identidade (travada na dependência 3.2) e a
API com credenciais do escritório (livre). O envio à assinatura eletrônica
continua parado no token de API do D4Sign.
