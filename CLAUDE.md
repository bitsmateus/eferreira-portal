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

Situação em **14/09/2026**, depois da segunda rodada de respostas. Das oito
dependências do Anexo II, **sete estão resolvidas**.

**3.1 — RESOLVIDA.** Os modelos viraram HTML em branco com marcadores em
`src/modelos/`; o sistema gera procuração, declaração e contrato em PDF. O
termo de acordo ficou fora do escopo. Ver `docs/modelos-de-documento.md`.

**3.2 — RESOLVIDA.** A logo em vetor **não vem, e não precisa**: o escritório
confirmou que "a logo e a identidade visual é o que já está, não precisa
ajustar nada". O desenho do protótipo é, portanto, a marca definitiva. Ela foi
aplicada ao cabeçalho e ao rodapé dos documentos gerados (regra 10), em traço
preto — ver `src/lib/timbre.ts`.

**3.4 — RESOLVIDA.** Assinatura eletrônica pelo D4Sign.

**3.5 — RESOLVIDA.** Lista de status por migração (`20260914093800`), campos
obrigatórios definidos com bloqueio de gravação, fluxo de acordo fora do
escopo, cliente lê a mensagem resumo.

**3.6 — RESOLVIDA no desenho, pendente na implantação.** O escritório tem SMTP
próprio e a entrada do cliente está de pé sobre ele. Faltam as credenciais:
servidor, porta, usuário, senha e o endereço remetente. **Sem elas nenhum
cliente entra.** Ver `docs/area-do-cliente.md`.

**3.7 — RESOLVIDA, com trabalho novo.** Não haverá lista prévia de
colaboradores: o escritório quer **criar, editar e excluir usuários dentro da
própria ferramenta**. Isso é a tela de Usuários, que ainda não existe.

**3.8 — RESOLVIDA.** Sem migração de histórico. O sistema começa vazio e
recebe só os clientes novos.

**3.3 — parcial, e é o que sobrou.**

- **Subdomínio: `portal.eferreira.adv.br`**, definido. Falta montar o registro
  de DNS na Locaweb, o que depende do endereço do servidor do EasyPanel.
- **Token de API do D4Sign:** o escritório foi conferir. A senha de login que
  mandaram antes não serve para integração.
- **Serviços que consumirão a API:** será uma **IA de atendimento**, a ser
  construída depois. A chave dela sai com acesso total, por decisão do
  escritório. Nada a gerar por ora.
- **Custo por envio da assinatura eletrônica:** ciente e aceito.

### Decisões registradas nesta rodada

1. **A cláusula 9ª repetida fica como está.** "Siga a versão enviada mesmo, sem
   alterações." É o que o sistema já faz — regra 10.
2. **Endereço profissional: o de São Paulo** (Gerônimo Barbosa da Silva, 159).
   "A princípio siga o de São Paulo, deixamos pendente isso." A divergência
   entre os dois modelos **continua aberta** e está marcada em
   `src/lib/escritorio.ts`. A comarca do foro não mudou.
3. **Documento por caso ou por cliente: fica como está** — contrato por caso,
   procuração e declaração por cliente.
4. **A tela de entrada do cliente continua sem o e-mail mascarado.** Aprovado.
5. **O cadastro continua sem o seletor "Tipo"** — derivado do documento.
6. **Não há download de documentos pela API.** Confirmado.

### A senha do D4Sign

O escritório decidiu **manter** a senha que trafegou em texto puro no WhatsApp
("vai ser essa mesma"). A recomendação de trocá-la foi feita e fica registrada
aqui. O sistema não usa essa senha — a integração vai pelo token de API —, então
o risco é do painel do D4Sign do escritório, não do portal.

**Enquanto uma dependência não responder: não invente conteúdo para destravar.**

## Estado atual

**Sprint 5 — a API do escritório está de pé** (14/09/2026). Anexo I, 3.b e
3.c: consulta por CPF ou CNPJ com o número do processo e o andamento, cadastro
e atualização de clientes, casos e andamentos, credenciais próprias com
permissão por chave, documentação em `docs/api.md` e ambiente de testes.

A validação é **a mesma do painel** — `validarCliente`, `validarCaso`,
`validarAndamento`. Se a tela recusa um cadastro, a API recusa também, com a
mesma mensagem; regra própria de API viraria, um dia, duas opiniões sobre o que
é cadastro válido.

A chave tem a forma `ef_live_<identificador>_<segredo>` e **aparece uma vez
só** — no banco existe só o hash. O identificador é público e indexado, o
segredo é SHA-256 comparado em tempo constante (e não Argon2id: o segredo são
192 bits sorteados, e hash lento em toda requisição seria ele próprio o jeito
de derrubar o serviço). Revogar vale na hora.

**O ambiente de testes é a instalação de homologação**, não um modo dentro da
mesma instalação: chave de teste que escreve no banco de produção não é
ambiente de testes. `AMBIENTE_DA_API` define o prefixo, e o padrão é o de
testes — instalação mal configurada erra para o lado inofensivo.

Cada credencial tem um usuário próprio, sem e-mail e sem senha, e é ele que
assina o andamento lançado pela API: na linha do tempo aparece "API · <nome da
chave>" (regra 6). Regra 12 continua valendo — o lançamento é manual, feito por
quem chama; ligar isto a um robô de tribunal é a fase 2.

**282 testes** (232 unitários, 50 contra o banco). Os da API entram pelas rotas
de verdade, porque é na rota que a permissão da chave é conferida.

**A identidade visual foi aprovada como está** (14/09/2026): o escritório
respondeu que a logo é a que já existe no sistema. Ela entrou no cabeçalho e no
rodapé dos documentos gerados, em traço preto — o timbre saiu dos modelos e
vive em `src/lib/timbre.ts`, porque o que está em `src/modelos/` é texto
jurídico do escritório e a regra 10 proíbe encostar nele.

**Falta da Sprint 5 a tela de Usuários**, pedida na mesma rodada: o escritório
não vai mandar lista de colaboradores, quer criar, editar e excluir os acessos
dentro da própria ferramenta.

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

Próximo passo: a **tela de Usuários** (dependência 3.7, respondida), e depois a
Sprint 6 — demonstração, aceite e produção. O que ainda falta de terceiros:
o registro de DNS de `portal.eferreira.adv.br` na Locaweb, as credenciais do
SMTP e o token de API do D4Sign.
