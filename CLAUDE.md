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

**3.2 — RESOLVIDA, e melhor do que se esperava.** O **papel timbrado de
verdade** estava dentro do `.docx` da procuração enviada em 14/09: imagem de
página inteira, com o monograma no alto, a marca d'água ao centro e os
contatos no pé. É o que o escritório usa no Word, e agora é o timbre dos
documentos gerados — em todas as páginas, com as margens do arquivo original.
Ver `src/lib/timbre.ts` e `src/modelos/timbre.png`.

O desenho que eu havia feito a partir do protótipo foi descartado.
**Atenção:** telefone, e-mail e site saem no rodapé pela IMAGEM. Se mudarem,
trocar `escritorio.ts` não basta — a imagem precisa ser substituída.

**3.4 — RESOLVIDA e IMPLEMENTADA** (15/09/2026). Assinatura eletrônica pelo
D4Sign, de ponta a ponta: enviar, acompanhar, receber o assinado de volta na
pasta do cliente e — no contrato — liberar o acesso ao portal sozinho. Ver
`docs/assinatura-eletronica.md`. **O primeiro envio de verdade ainda não foi
feito**: ele gasta um crédito e manda e-mail real, e deve ir para um endereço
do próprio escritório.

**3.5 — RESOLVIDA.** Lista de status por migração (`20260914093800`), campos
obrigatórios definidos com bloqueio de gravação, fluxo de acordo fora do
escopo, cliente lê a mensagem resumo.

**3.6 — RESOLVIDA.** O e-mail é **Gmail** (Google Workspace),
na conta `contato@eferreira.adv.br`. Servidor, porta, usuário e remetente já
estão no `.env.example`, e a senha de app já entrou no `.env` local e no
EasyPanel (ver adiante).

**A senha comum da conta não serve.** O Google recusa SMTP com senha de conta:
é preciso verificação em duas etapas e uma **senha de app** de dezesseis
caracteres. Com a senha comum a resposta é sempre "535-5.7.8 Username and
Password not accepted", e nenhuma configuração resolve. Para conferir sem
adivinhar: `npm run email:teste`. Ver `docs/area-do-cliente.md`.

**Situação conferida no EasyPanel em 15/09/2026, e ela é boa:** a senha de
app de dezesseis caracteres **está** em `SMTP_SENHA` nos dois projetos, e o
Google **aceita** o login — conferido pelo aperto de mão SMTP completo
(conectar, STARTTLS, autenticar, encerrar), sem entregar mensagem a ninguém.
Servidor `smtp.gmail.com:587`, usuário `contato@eferreira.adv.br`.

**O que estava errado era a parte do `.env` local**, e continua: não há
nenhuma variável `SMTP_*` aqui, e por isso `npm run email:teste` responde
"SMTP não configurado" **nesta máquina**. Em desenvolvimento, o e-mail que
sairia é impresso no terminal — comportamento desenhado, não defeito. Quem
quiser testar envio de verdade localmente copia as variáveis do EasyPanel
para o `.env` (que está no `.gitignore` — regra 8).

**3.7 — RESOLVIDA, e a tela já existe.** Não haverá lista prévia de
colaboradores: o escritório quer **criar, editar e excluir usuários dentro da
própria ferramenta**. A tela de Usuários está pronta desde 14/09/2026 — ver
"Estado atual" mais abaixo.

**3.8 — RESOLVIDA.** Sem migração de histórico. O sistema começa vazio e
recebe só os clientes novos.

**3.3 — RESOLVIDA na parte de infraestrutura; falta só o que segue abaixo.**

- **Subdomínio: `portal.eferreira.adv.br` — RESOLVIDO e no ar.** Registro A na
  Locaweb apontando para `187.127.54.204`, uma VPS Hostinger
  (`srv1911163.hstgr.cloud`).
- **Aplicação em produção: PUBLICADA e no ar** (14/09/2026), em
  `https://portal.eferreira.adv.br` — TLS ativo, `prisma migrate deploy`
  rodou na subida, o administrador semeado e o login conferidos de ponta a
  ponta. Detalhes e as quatro armadilhas do deploy em
  `docs/03-implantacao-easypanel.md`. A instalação de **homologação** está
  construída, mas sem domínio — falta o registro de DNS para
  `homologacao.eferreira.adv.br`.
- **Backup:** falta ativar o backup automático do Postgres no EasyPanel e
  repetir `npm run banco:teste-restauracao` em produção (já foi executado com
  sucesso em desenvolvimento, antes de existir dado real).
- **SMTP: RESOLVIDO e conferido em produção e homologação** (15/09/2026).
  `SMTP_SENHA` está nos dois projetos e o Gmail aceita o login. Ver a
  dependência 3.6, acima. Falta só o primeiro envio de verdade, que só
  acontece quando existir um cliente com e-mail cadastrado.

A infraestrutura de base: dois projetos no EasyPanel, `eferreira-producao` e
`eferreira-homologacao`, cada um com **Postgres 16** e **MinIO**. O servidor
hospeda outro cliente (projeto `consensus`) — não se encosta nele.

O balde `eferreira-documentos` existe nos dois, e a **regra 5 foi conferida
contra o armazenamento de verdade**: leitura sem assinatura devolve 403, não há
política pública, e a URL assinada funciona.

**Armadilha registrada:** a imagem `minio/minio` do Docker Hub dá "pull access
denied" no servidor. A que funciona é `quay.io/minio/minio:latest`, o registro
oficial da MinIO. O `docker-compose.yml` de desenvolvimento ainda usa a do
Docker Hub, que só continua funcionando por já estar em cache local.

Os segredos gerados (senhas do Postgres e do MinIO) **só existem no EasyPanel**
— nunca passaram pelo repositório. Ficam visíveis em cada serviço, na aba
Environment.

- **D4Sign: RESOLVIDO de ponta a ponta** (14/09/2026). Token de produção e
  crypt key já estão no EasyPanel e foram conferidos localmente com
  `npm run d4sign:conta` (só leitura — não gasta crédito nem manda e-mail):
  ambiente de produção, **26 cofres**, e o cofre configurado em
  `D4SIGN_COFRE` bate exatamente com o **"Escritorio"** da conta. Restam
  **31 envios** de 50 créditos.

  **Não existe ensaio:** todo envio de verdade (fora do `d4sign:conta`)
  consome um crédito do escritório (custo de terceiro, Cláusula 6ª) e manda
  e-mail de assinatura de verdade para quem estiver na lista.

  A conta é compartilhada com documentos de muitos clientes, já separados
  por área — "Procurações Civeis", "contratos eFerreira advogados" —, e o
  cofre escolhido é o genérico do escritório.

  **RISCO FECHADO em 16/09/2026** — `D4SIGN_TOKEN_API` foi esvaziada na
  homologação. O que segue fica registrado porque explica por que ela está
  assim e o que fazer quando houver um token de sandbox.

  **Encontrado em 15/09/2026: a HOMOLOGAÇÃO estava com o token de
  PRODUÇÃO da D4Sign**, apontando para `secure.d4sign.com.br` e para o mesmo
  cofre "Escritorio". Um teste feito no ambiente de testes gastaria crédito de
  verdade, mandaria e-mail de verdade e deixaria documento de mentira dentro
  do cofre real do escritório — onde nada pode ser apagado.

  É o oposto do que a Sprint 5 decidiu para a API ("chave de teste que escreve
  no banco de produção não é ambiente de testes"). Havia duas saídas: um
  token de sandbox da D4Sign para a homologação, ou deixar
  `D4SIGN_TOKEN_API` vazio lá. **DECIDIDO em 21/09/2026: sem sandbox** — a
  homologação segue sem assinar (`D4SIGN_TOKEN_API` vazio, como já estava),
  usando só o token de produção quando for o caso de testar de verdade. Não
  testar assinatura em homologação.
- **Serviços que consumirão a API:** será uma **IA de atendimento**, a ser
  construída depois. A chave dela sai com acesso total, por decisão do
  escritório. Nada a gerar por ora.
- **Custo por envio da assinatura eletrônica:** ciente e aceito.

### Decisões registradas nesta rodada

1. **A cláusula 9ª repetida fica como está.** "Siga a versão enviada mesmo, sem
   alterações." É o que o sistema já faz — regra 10.
2. **Endereço profissional: RESOLVIDO.** "Rua Olegário Paiva, 180, 4º andar,
   sala 411 — Mogi das Cruzes/SP — CEP 08780-040, este é o correto." A
   procuração nova traz o mesmo endereço, com o bairro.
3. **A cidade da assinatura vem do cadastro do CLIENTE**, não do escritório.
   Por isso o cadastro ganhou os campos **cidade** e **UF**, obrigatórios, e o
   campo de endereço passou a guardar só logradouro, número, complemento e
   bairro.
4. **A procuração tem duas variantes**, PF e PJ, conforme o tipo de cliente.
   O texto dos poderes é um só; mudam a qualificação e a assinatura.
5. **Documento por caso ou por cliente: fica como está** — contrato por caso,
   procuração e declaração por cliente.
6. **A tela de entrada do cliente continua sem o e-mail mascarado.** Aprovado.
7. **O cadastro continua sem o seletor "Tipo"** — derivado do documento.
8. **Não há download de documentos pela API.** Confirmado.

### O que já foi perguntado (21/09/2026)

1. **O bloco de pessoa física da procuração — RESOLVIDO, nada muda.** Ele não
   veio no arquivo novo, que é de cliente PJ; tinha ficado o texto do modelo
   anterior do escritório, encaixado no texto novo. Perguntado se precisava
   de atualização: a procuração PJ (a nova) é a versão atualizada e vale como
   está; o bloco PF continua com o texto que já tinha, sem mudança nenhuma —
   não há texto novo do escritório para ele.
2. **Declaração e contrato — RESOLVIDO por ora.** "Temos somente esses
   mesmo" — o texto que já está no sistema (transcrito do .docx de 14/09)
   continua valendo. Se o escritório mandar uma versão atualizada de
   qualquer um dos dois, ela substitui; até lá, nada a fazer.
3. **A cláusula 9ª repetida** continua no contrato que vai para assinatura.
   Registrado que é para seguir assim, mas o defeito é deles.

### A senha do D4Sign

O escritório decidiu **manter** a senha que trafegou em texto puro no WhatsApp
("vai ser essa mesma"). A recomendação de trocá-la foi feita e fica registrada
aqui. O sistema não usa essa senha — a integração vai pelo token de API —, então
o risco é do painel do D4Sign do escritório, não do portal.

**Enquanto uma dependência não responder: não invente conteúdo para destravar.**

## Estado atual

**Mais três mudanças pedidas em 22/09/2026, decididas sozinho enquanto o
escritório estava fora — CONFIRMAR na volta:**

3. **A mensagem do WhatsApp já chega escrita.** O botão flutuante (e o link
   de texto do `/consultar`) agora abrem a conversa com "Olá! Vim pelo site
   do Portal do Cliente e preciso de ajuda para acessar." já no campo — a
   pessoa que atende sabe de onde veio e o que precisa, sem perguntar de
   novo; quem manda a mensagem ainda decide se manda como está ou edita
   antes. Mensagem única em `MENSAGEM_DE_SUPORTE_NO_WHATSAPP`
   (`src/lib/escritorio.ts`), usada nos dois lugares.

4. **"Escolha o cliente" (Novo caso) virou busca por nome ou CPF/CNPJ.** Era
   uma lista suspensa comum com todo cliente cadastrado — inviável assim que
   a base cresce. Componente novo, `SeletorDeCliente`
   (`src/componentes/seletor-de-cliente.tsx`): um campo de texto que filtra a
   lista (já carregada na página, sem ida ao servidor a cada letra) por nome
   ou documento, com navegação por teclado. Continua submetendo `clienteId`
   por um campo escondido — o servidor confere de novo quem pode usar aquele
   cliente (regra 2), a busca não decide nada.

5. **Empresa e representante legal agora se enxergam nos dois sentidos.**
   Já dava para ver, na ficha da EMPRESA, o sócio que assina por ela (cartão
   "Representantes legais", com link para a ficha dele). Faltava o
   contrário: abrir a ficha do SÓCIO e ver quais empresas ele representa —
   o dado (`empresasQueRepresenta`) já era buscado no banco desde a Sprint
   1, mas não tinha tela nenhuma. Cartão novo, "Representa"
   (`EmpresasQueRepresenta`, no mesmo arquivo de `RepresentantesLegais`),
   só leitura — vincular e desvincular sócio continuam feitos do lado da
   empresa, que é onde isso já fazia sentido.

   Testado no navegador de verdade: cadastrada uma empresa com sócio,
   buscar "aurora" no seletor de cliente encontra os dois (o sócio e a
   empresa) pelo nome, e a ficha do sócio mostra a empresa com a
   qualificação, linkada.

**Duas mudanças pedidas em 22/09/2026, decididas sozinho enquanto o
escritório estava fora — CONFIRMAR na volta:**

1. **Honorários fixos viraram seleção, com forma de pagamento.** Antes: um
   campo de valor e uma tabela com 12 linhas de parcela sempre visíveis, a
   maioria vazia. Agora: um seletor "Forma de pagamento" (À vista / Pix /
   Transferência bancária / TED / Boleto bancário) e um seletor "Quantidade
   de parcelas" (1 a 12) — escolhida a quantidade, só aquelas linhas
   aparecem para preencher; diminuir a quantidade apaga o que estava nas
   linhas que somem, para não sobrar dado escondido sendo salvo à toa.

   **A forma de pagamento entra no texto do contrato**, não é só
   organização de tela — decisão tomada em conversa nesta mesma sessão.
   Campo novo, `Caso.canalDePagamentoFixo` (migração
   `20260922125151_canal_de_pagamento_dos_honorarios_fixos`), nulo por
   padrão. Nulo
   é a opção "À vista" da tela — não cita canal nenhum, e o texto sai
   exatamente como antes: "mediante parcela única..." / "mediante 3(três)
   parcelas, sendo...". Um canal escolhido entra como prefixo: "mediante
   Pix, em parcela única, com vencimento em 09/10/2026" ou "mediante boleto
   bancário, em 3(três) parcelas, sendo...". Este prefixo **não é texto do
   escritório** — é nosso, dentro do espaço em branco "[FORMA_DE_PAGAMENTO]"
   que o modelo já deixava livre — então não fere a regra 10, mas vale o
   escritório conferir se a frase ficou como eles queriam.

   Testado no navegador de verdade: escolher 3 parcelas mostra 3 linhas,
   reduzir para 1 esconde as outras duas, salvar grava certinho no banco
   (conferido direto na tabela). Testado também contra o banco que o texto
   "mediante Pix, em parcela única" sai no contrato gerado.

2. **Botão do WhatsApp virou flutuante**, nas duas telas do cliente
   (`/consultar` e `/meus-processos`) — pedido junto com um print mostrando
   o link de texto perdido no canto superior direito, difícil de notar.
   Agora é um círculo verde (`#25D366`, a cor de marca do WhatsApp — única
   exceção à paleta grafite/prata do produto, de propósito, porque é
   exatamente o que faz esse botão ser reconhecido como "abre uma
   conversa") com ícone de telefone branco, fixo no canto inferior direito
   da tela, sempre visível. Componente novo,
   `src/componentes/botao-flutuante-whatsapp.tsx`.

   **Decisão tomada sozinho, sem perguntar**: no `/consultar`, o texto
   "Não conseguiu acessar ou não recebeu o código? Fale conosco pelo
   WhatsApp" foi MANTIDO do jeito que estava (ele responde a uma dúvida
   específica, no lugar certo da tela) — o botão flutuante foi só
   ACRESCENTADO, como um segundo caminho para o mesmo link. Já no
   `/meus-processos`, o link de texto que ficava sozinho no topo (o do
   print) foi REMOVIDO e substituído pelo botão flutuante — lá não havia
   texto de contexto para preservar, só o link solto.

   Testado no navegador de verdade (captura de tela do `/consultar`): o
   círculo aparece no canto certo, por cima do conteúdo, sem atrapalhar o
   formulário.

**Contrato por partes: objeto, honorários e testemunhas** (21/09/2026), a
partir de três respostas do escritório e dois arquivos `.docx` que chegaram
no WhatsApp. É a maior mudança no contrato desde a Sprint 3, e tem UMA
pendência que impede de emitir contrato para cliente sem conversar antes — a
numeração (abaixo).

1. **O contrato deixou de ser um texto só.** `Objeto do contrato.docx` traz
   cinco variações da cláusula de objeto (consumidor/plano de saúde,
   trabalhista, cível, revisional, personalizado) e `honorarios do
   contrato.docx` traz quatro blocos combináveis (fixos, êxito, proveito
   econômico, personalizados) mais um bloco comum (3.5 a 3.9). Cada variação e
   cada bloco é um arquivo em `src/modelos/contrato-objeto-*.html` e
   `contrato-honorarios-*.html`, com o texto do escritório transcrito sem
   alterar palavra (regra 10); o contrato principal encaixa os dois com
   `{{>objeto}}` e `{{>honorarios}}`. Quais entram é decisão de
   `arquivoDoObjeto` e `arquivosDosHonorarios`, em `src/lib/modelos.ts`, as
   mesmas funções que os testes usam. Mapa completo em
   `docs/modelos-de-documento.md`.

2. **O caso guarda o que o contrato precisa** (migração
   `20260921190613`): `tipoDeObjeto`, `descricaoDoObjeto` (o texto que entra
   no lugar de "[DESCREVER A DEMANDA...]"), `referenciaDaEconomia` e
   `prazoDePagamentoDaEconomia` (bloco 3), e `honorariosPersonalizados` com
   oito campos de texto livre (bloco 4). O formulário do caso ganhou a seção
   "Objeto do contrato" e os campos de cada modalidade, com a frase do modelo
   como dica em cada campo livre. **Opcionais ao salvar, obrigatórios ao
   gerar**: quem cadastra o caso ainda sem acordo fechado não é travado; ao
   gerar, a tela diz exatamente o que falta e leva para a edição do caso.

3. **Honorários fixos exigem ao menos uma parcela.** O modelo do escritório
   pede "mediante [FORMA_DE_PAGAMENTO], com vencimento [VENCIMENTOS]", e "à
   vista" sem data não diz quando vence. Em vez de inventar uma data, o
   contrato **não sai** sem parcela; quem vai à vista cadastra uma parcela
   única com o vencimento.

4. **A trava de êxito/proveito econômico caiu** — o texto chegou. A antiga
   Cláusula 2ª (com a conta bancária, o Pix e o item 2.3, "caso não haja
   proveito econômico, não será devido qualquer valor", que contradiria os
   honorários fixos) saiu inteira: o texto novo a substitui.

5. **Testemunhas no contrato.** "As assinaturas de testemunha vamos manter
   para os documentos avulso e o contrato de honorários." Na tela de envio do
   contrato, cliente e escritório seguem automáticos e as testemunhas são
   escolhidas ali (do cadastro de Partes — só as do papel testemunha —, ou
   digitadas), opcionais. `partesDoEnvio` (`src/lib/assinaturas.ts`) impõe que
   quem entra pelo contrato entra SEMPRE como testemunha, seja qual for o
   papel que veio do navegador (regra 2). O mesmo formulário do anexo serve
   aos dois.

6. **WhatsApp confirmado** ("isso mesmo o whatsapp é o oficial mesmo") — ver a
   reunião de 17/09, item 3.

7. **Um defeito achado no caminho, corrigido:** `aplicarPartes` trocava
   `{{>parte}}` até dentro de comentário HTML. O comentário do contrato citava
   `{{>objeto}}`, a parte entrava ali com o comentário dela, o `-->` de dentro
   fechava o de fora e o resto da nota interna aparecia impresso no contrato.
   Agora os comentários saem ANTES de encaixar as partes.

**PENDENTE COM O ESCRITÓRIO — a numeração, e enquanto isso NÃO se emite
contrato para cliente com este texto.** O arquivo novo chama os honorários de
"CLÁUSULA TERCEIRA" (itens 3.1 a 3.9) e o objeto de "CLÁUSULA PRIMEIRA". As
demais cláusulas (Despesas em diante) continuam com o texto e a numeração de
14/09/2026, e por isso o contrato gerado hoje tem dois "3": a Terceira
(honorários) e a "3ª — Despesas Processuais", cujos itens também são 3.1 e
3.2. Renumerar seria mexer no texto do escritório (regra 10). **Combinado: o
escritório manda o contrato completo com a numeração final.** Ainda a
perguntar: (a) os itens 3.1 a 3.4 sempre com o número do arquivo, mesmo quando
só um bloco entra (só êxito abre em "3.2")? (b) a conta bancária e o Pix
deixaram de constar — é isso mesmo?

8. **Passada de espaçamento nos PDFs** (21/09/2026, depois de gerar os quatro
   documentos com dado realista e ler página por página). Três defeitos
   achados e corrigidos, todos de CSS ou de formatação de dado — nenhuma
   palavra do escritório foi tocada:
   - **Assinatura sozinha numa página** (procuração de pessoa jurídica, cuja
     assinatura tem três linhas): a data ficava no fim da página 1 e a
     assinatura, sozinha, numa página 2 quase vazia. Agora a data não se separa
     da assinatura e, quando o bloco não cabe, o parágrafo anterior leva
     consigo ao menos quatro linhas (`p:has(+ .local-e-data)` em
     `estilo.css`) — assinatura nunca fica numa página sem texto.
   - **Título órfão**: "CLÁUSULA TERCEIRA — DOS HONORÁRIOS" ficava sozinho no
     pé da página 1, com o conteúdo na 2. `h1, h2 { break-after: avoid }`.
   - **Estado civil com maiúscula no meio da frase** ("brasileira, Casada, nome
     da mãe"): consequência da lista fechada de 18/09, cujas opções são
     capitalizadas. O documento passa a escrever em minúscula.

**Verificado:** 434 testes unitários, 139 contra o banco, `tsc`, lint e
`npm run build`. PDF do contrato com as quatro modalidades gerado e lido
página a página (margens do timbre ok). Formulário do caso e tela de
assinatura do contrato conferidos no navegador de verdade — gravou os campos
novos, mostrou as testemunhas cadastradas (a parte contrária ficou de fora) e
a revisão listou as quatro pessoas. O envio em si NÃO foi feito: a integração
ficou apontada para um endereço morto durante o teste, e nenhum crédito foi
gasto.

**Documentos "cortados" — achada a causa, e ela vinha do início** (18/09/2026).
O escritório reportou que todo documento gerado estava saindo com o texto
sobreposto pelo cabeçalho e pelo rodapé — não só documento longo: uma
procuração de uma página só já nascia com o cabeçalho por cima da primeira
linha do texto.

Reproduzido gerando contrato, procuração (PF e PJ) e declaração pelo mesmo
caminho da aplicação, com dados de teste propositalmente compridos, e
inspecionando os PDFs de verdade: o cabeçalho colava sobre a última linha da
cláusula de cada página e o rodapé sobre a primeira do topo seguinte, em
TODO documento, começando já na página 1 — sinal de que não era acúmulo de
erro em documento longo, era estrutural.

A causa: `src/modelos/estilo.css` tinha `@page { size: A4; margin: 0; }`.
Um `@page` com `margin: 0` **explícito** faz o Chromium ignorar o `margin`
de `page.pdf()` (em `src/lib/pdf.ts`) para o fluxo do corpo do texto — o
texto passa a começar no canto físico da folha (y=0), por baixo de onde o
`headerTemplate`/`footerTemplate` são desenhados (que continuam vindo do
`margin` do `page.pdf()`, por isso pareciam certos isoladamente). Isolado
com um teste à parte, fora do código do sistema: com `@page { margin: 0 }`,
um parágrafo de teste nascia colado no topo físico da página, ignorando
completamente os 4,14cm de margem pedidos; bastou tirar o `margin: 0` do
`@page` (deixando só `size: A4`) para o texto voltar a respeitar a margem
em todas as páginas de um PDF de 6 páginas gerado só para o teste.

A correção foi uma linha: tirar `margin: 0` do `@page`. De brinde, a
`.marca-dagua` (`position: fixed; top: 4.14cm`) passou a alinhar certinho
com o texto em toda página sem precisar de nenhuma conta nova — o comentário
antigo dizia que a origem de um elemento fixo era o canto físico da folha
"porque" o `@page` não declarava margem; era o contrário: é exatamente por
`@page` não declarar margem nenhuma (nem `0`) que a origem de um elemento
fixo passa a ser a MESMA área que `page.pdf({ margin })` reserva. Os dois
comentários grandes em `estilo.css` foram reescritos para não repetir o
raciocínio invertido.

Conferido de novo, pelo caminho real da aplicação: contrato de 4 páginas,
procuração PF e PJ, declaração — cabeçalho, marca d'água e rodapé sem tocar
o texto em nenhuma página. 399 testes unitários, 135 contra o banco, `tsc`
e `npm run build` verdes.

**Quatro itens da lista de melhorias, feitos em 18/09/2026** — os que não
dependiam de resposta do escritório, depois da reunião de 17/09:

1. **Tela de Documentos está de pé** (`/painel/documentos`), item 2 da lista
   — a pergunta do dia a dia era "quais contratos estão aguardando
   assinatura?", e só se respondia abrindo cliente por cliente. A tela nova
   cruza documento de todos os clientes, com busca (nome, CPF/CNPJ ou nome do
   arquivo), filtro por tipo e por situação de assinatura. A situação
   (assinado/aguardando/não enviado) não é coluna do banco — é calculada a
   partir do envio mais recente (`situacaoDeAssinaturaDoDocumento`, em
   `src/lib/documentos.ts`), a mesma lógica que a pasta do cliente já usava,
   agora olhando para TODOS os documentos (`enviosRecentes`, em
   `assinaturas.ts`) em vez de um cliente só. A pasta de cada cliente
   continua existindo do mesmo jeito — esta tela é a visão de cima.

2. **Cliente pode ser desativado**, item 4 ("não há como remover cliente
   cadastrado por engano"). Campo novo, `Cliente.situacao` (migração
   `20260918140528`, `SituacaoCliente.ATIVO`/`INATIVO`), mesmo padrão de
   `SituacaoUsuario`: desativar não apaga nada, só fecha a porta — o cliente
   inativo para de conseguir pedir código de acesso ao portal, com a MESMA
   resposta genérica de sempre (`pedirCodigo` nunca revela se o motivo foi
   "não existe" ou "está desativado"). Desativar pede confirmação (bloqueia
   o portal de alguém); reativar não pede, porque não desfaz nada que valha
   a pena proteger com um clique a mais — mesmo cuidado de
   `desativarUsuario`/`reativarUsuario`, na tela de Usuários. Filtro de
   situação novo na lista de clientes, e o menu de cada linha ganhou
   "Desativar"/"Reativar".

3. **Estado civil virou lista fechada**, item 3 ("em seis meses haverá
   'solteira', 'Solteira' e 'SOLTEIRO' no banco" com campo livre). A lista
   (`ESTADOS_CIVIS`, em `campos-do-cliente.ts`) tem cada forma gramatical
   como opção própria — "Solteiro" e "Solteira" separados, e assim por
   diante — em vez de um campo de gênero à parte: o texto que vai para o
   documento assinado precisa concordar com a pessoa, e a lista fechada
   resolve isso sem mudar o esquema. Continua sendo texto solto no banco
   (`estadoCivil String?`); só a TELA passa a oferecer estas opções, tanto no
   cadastro do cliente quanto no do representante legal.

4. **"Anexado por" só aparece em documento que alguém realmente anexou**,
   item 5. Campo novo, `Documento.origem` (mesma migração `20260918140528`,
   `OrigemDoDocumento`: `GERADO` | `ANEXADO` | `ASSINADO_NA_D4SIGN`),
   independente do `tipo` — a tela de anexo deixa escolher tipo
   CONTRATO/PROCURAÇÃO/DECLARAÇÃO ao subir, por exemplo, um contrato
   assinado em papel e digitalizado, e esse documento é `tipo: CONTRATO` mas
   `origem: ANEXADO`. Documento que veio de `gerarDocumento` mostra "gerado
   por", o que veio de `anexarDocumento` mostra "anexado por", e o PDF que
   voltou assinado da D4Sign mostra "recebido da assinatura eletrônica", sem
   atribuir a ninguém uma ação automática. Backfill do dado antigo (que não
   tinha esta coluna) foi por SQL na própria migração — é a melhor inferência
   possível, não garantia perfeita: um contrato em papel digitalizado ANTES
   desta coluna existir fica classificado como GERADO por engano. Registrado
   no comentário do enum, em `schema.prisma`.

**O item 1 da rodada de 17/09 — posição fixa da assinatura no PDF — não
entrou, e o motivo é técnico, não falta de tempo.** A pesquisa na API da
D4Sign mostrou que dá para fixar coordenada (x, y, página) de assinatura,
mas isso pressupõe que a posição é sempre a mesma — e não é: a assinatura de
contrato, procuração e declaração fica no fim de um texto de tamanho
VARIÁVEL (o assunto do caso, os honorários, o nome da parte contrária mudam
o tamanho do documento), então tanto a página quanto a posição na página
mudam de contrato para contrato. Forçar isso a uma posição fixa exigiria
quebrar a assinatura para uma página própria (`page-break-before: always`
antes do bloco de assinatura) — o que é uma mudança de LAYOUT do documento,
não só de posicionamento técnico, e por isso fica para conversar com o
escritório antes de implementar, em vez de decidir sozinho que o documento
ganha uma página a mais.

399 testes unitários, 135 contra o banco, build de produção conferido.

**Reunião de demonstração com o escritório em 17/09/2026** — cinco pedidos
saíram dali, todos implementados e testados:

1. **Representante legal virou obrigatório no CADASTRO de pessoa jurídica**,
   não só na ficha depois. "Quando eu cadastrar uma empresa, eu preciso
   cadastrar um representante legal também" — até aqui dava para salvar um
   CNPJ sem sócio nenhum, e só a geração de documento percebia a falta,
   tarde no fluxo. Agora o formulário de cadastro de cliente, quando o
   documento digitado é um CNPJ, pede as informações do sócio (mesmos campos
   da pessoa física, e-mail e telefone obrigatórios) e cria os dois — empresa
   e sócio — na mesma transação. Regra 4 continua valendo para o sócio: se o
   CPF já é cliente cadastrado, reaproveita em vez de duplicar. A tela de
   "Representantes legais" na ficha continua existindo, para adicionar mais
   sócios depois ou resolver empresa cadastrada antes desta mudança.

2. **Nome da mãe deixou de ser obrigatório**, para qualquer pessoa física —
   cliente ou representante legal. Pedido explícito do escritório nesta
   reunião; o campo continua existindo no cadastro, só não bloqueia mais a
   gravação.

3. **Botão "Fale conosco pelo WhatsApp"** em `/consultar` e `/meus-processos`
   — as telas do CLIENTE, não o painel interno da equipe (a reunião falou
   "no painel e no menu de login" pensando na experiência de quem consulta o
   processo, não de quem já trabalha na ferramenta). Número:
   `(11) 4580-3696`, guardado em `ESCRITORIO.whatsappDeSuporte`. **Atenção:**
   esse número é DIFERENTE do `ESCRITORIO.whatsapp` já cadastrado (o pessoal
   do advogado, citado na procuração) — os dois convivem de propósito, mas
   vale confirmar com o escritório se realmente são dois números distintos.
   **Respondido em 21/09/2026:** "isso mesmo o whatsapp é o oficial mesmo".
   Confirmado como o número oficial; nada muda no código.

4. **Honorários ganharam três modalidades combináveis**: fixo (à vista ou
   parcelado, como já era), êxito (percentual de 10% a 30%, sem entrada) e
   percentual sobre o proveito econômico (10% a 30%). Um caso pode ter uma,
   duas ou as três ao mesmo tempo — migração `20260917193752`, campos
   `percentualExito` e `percentualProveitoEconomico` no `Caso`.

   **RESOLVIDO em 21/09/2026.** Até então isto NÃO gerava contrato, de
   propósito: a cláusula 2ª só descrevia valor fixo, e escrever a redação das
   modalidades novas seria reescrever texto jurídico (regra 10). O escritório
   mandou o texto ("honorarios do contrato.docx") e a trava foi removida —
   ver a entrada de 21/09/2026, no topo deste "Estado atual".

5. **Cadastro de partes e assinatura de documento avulso.** Pedido do
   escritório: anexar um documento pronto (ex.: termo de acordo) e mandar
   para assinatura de gente que não é cliente — parte contrária, testemunha,
   advogado externo. Modelo novo, `Parte` (migração `20260917194611`),
   **de propósito sem nenhuma ligação com `Cliente`**: "eu não sei se vai ser
   cliente ou não, é informação transitória, não quero contaminar meu banco
   de dados principal de clientes". Tela em `/painel/partes` (cadastrar,
   listar, excluir — sem trava de "tem histórico", porque nada aponta para
   uma `Parte` por chave estrangeira; quem já assinou fica gravado como JSON
   em `EnvioParaAssinatura.signatarios`, um retrato daquele envio).

   Documento do tipo ANEXO agora VAI para assinatura — antes não ia. A
   diferença para contrato/procuração/declaração: ninguém assina
   "automaticamente" a partir do cliente. Na tela de envio
   (`/painel/documentos/[id]/assinatura`), quando o documento é um anexo, a
   pessoa escolhe quem assina — do cadastro de Partes, e/ou digitado na hora,
   sem entrar no cadastro — antes de qualquer preparo. A lista escolhida
   viaja para o servidor como JSON, e `lerAvulsos` (`src/lib/assinaturas.ts`)
   nunca confia nela sem validar de novo.

   **Isto reverte, só para documento avulso, uma decisão de 14/09/2026**:
   "testemunhas ficam no papel, cada uma seria mais um endereço a cadastrar".
   Contrato, procuração e declaração — os três que o próprio sistema gera —
   continuam sem testemunha nenhuma na D4Sign; a mudança vale só para ANEXO.
   **Confirmado e AMPLIADO em 21/09/2026:** "as assinaturas de testemunha
   vamos manter para os documentos avulso e o contrato de honorários" — ou
   seja, o CONTRATO também passa a ter testemunhas na D4Sign (ver o topo deste
   "Estado atual"). Procuração e declaração continuam sem testemunha.

   Achado no meio do caminho: os dois componentes novos (`lista.tsx` de
   Partes e o formulário de assinatura de anexo) importavam `ROTULO_DO_PAPEL`
   direto de `assinaturas.ts` — um arquivo de servidor que arrasta Prisma,
   Argon2 e nodemailer. O build de produção quebrou por causa disso
   (`Module not found: '@node-rs/argon2-wasm32-wasi'`), e a correção foi a
   mesma separação de sempre (`campos-do-cliente.ts`, `arquivos.ts`): os
   rótulos saíram para `src/lib/rotulos-de-assinatura.ts`, sem nada de
   servidor, para um componente `'use client'` poder importar só o que
   precisa desenhar.

391 testes unitários, 124 contra o banco.

**Passada de responsividade em todo o painel** (17/09/2026), pedido do
escritório para terminar o sistema: celular, tablet e telas menores em
geral. Achados dois defeitos estruturais que afetavam o painel inteiro, mais
alguns pontuais — todos corrigidos e conferidos com capturas de tela reais
em 375px (celular) e 820px (tablet), contra o build de produção.

1. **A barra lateral inteira sumia no celular.** Abaixo de `md`, o `<aside>`
   com toda a navegação (Painel, Clientes, Casos, Usuários, API) e o "Sair"
   ficava com `hidden`, e a barra de topo do celular só mostrava a logo —
   sem hambúrguer, sem nada. Quem abrisse o sistema no celular não tinha
   como trocar de tela nem sair da conta. `menu-mobile.tsx` é a correção:
   um botão ☰ que abre uma gaveta (mesmo conteúdo do `<aside>`, via
   `ConteudoDoMenu` compartilhado) deslizando da esquerda, com fundo
   escurecido — fecha sozinha ao navegar, pelo X, pelo Esc ou clicando fora.

2. **Toda tela de duas colunas (`grid lg:grid-cols-[...]`) podia estourar a
   largura no tablet.** Um item de grid tem `min-width: auto` por padrão —
   a mesma armadilha do `min-height: auto` do flexbox que já tinha aparecido
   na barra lateral (ver mais abaixo), só que no eixo horizontal. Na
   prática: uma tabela larga (Casos vinculados, na ficha do cliente) forçava
   a coluna inteira a crescer além do espaço disponível, cortando botões e
   colunas no tablet mesmo com a tabela tendo sua própria rolagem interna.
   `min-w-0` nos filhos diretos de todo grid de duas colunas do painel —
   ficha do cliente, ficha do caso, gerar documento, API, Usuários e os três
   formulários — resolve, deixando a rolagem interna de cada tabela agir de
   verdade em vez de brigar com o grid por espaço.

3. **Botões de ação por linha (Assinar/Abrir/Baixar/Excluir na pasta do
   cliente, Revogar na API) não quebravam linha** quando não cabiam ao lado
   do texto — cortavam no meio, sem rolagem nem quebra. `flex-wrap` nesses
   grupos, e defensivamente em `.cartao-cabecalho` (usado em toda a tela).

4. **A rolagem lateral das tabelas ganhou uma "sombra de rolagem"** — duas
   faixas que aparecem só no lado em que ainda há conteúdo para ver,
   apagando sozinhas conforme a rolagem chega à borda. A rolagem em si já
   funcionava (conferido programaticamente); só faltava dar a ver que ela
   existe, num celular sem barra de rolagem visível.

Formulários, telas públicas (`/entrar`, `/consultar`, `/recuperar-senha`) e
o restante do painel já colapsavam para uma coluna corretamente — conferido,
não mexido.

355 testes unitários e 110 contra o banco.

**"Este andamento encerra o caso" está de pé** (17/09/2026), pedido do
escritório: até aqui, arquivar um caso exigia dois passos — lançar o
andamento e depois abrir "Editar" só para trocar a situação. Agora o
formulário de "Novo andamento" tem uma caixinha logo acima de "Lançar
andamento", e marcá-la arquiva o caso no mesmo clique.

O andamento e o arquivamento do caso acontecem na MESMA transação — não tem
como um valer sem o outro. A auditoria (regra 6) guarda a mudança de
situação como um registro próprio (`entidade: 'caso'`, `motivo:
'encerrado_junto_com_o_andamento'`), distinto de uma edição manual, e
aponta para o andamento que a causou. Marcar a caixinha de novo num caso já
arquivado não grava nada repetido — não é fato novo.

Ficou junto do pedido anterior de reorganizar a tela: "Editar", "Gerar
documento" e "Excluir" saíram do topo da ficha do caso e foram para a mesma
linha de "Lançar andamento", que é onde a atenção já está.

355 testes unitários e 110 contra o banco.

**Documento assinado pelos dois e o portal continuava dizendo "aguardando"
— achada a causa, e ela é séria** (17/09/2026). O escritório assinou de
ponta a ponta um contrato de teste (as duas partes, pelo e-mail da D4Sign) e
o painel continuou marcando "Aguardando assinatura" mesmo depois de conferir
de novo. Não era cache nem código travado: `conferirAssinatura` de fato
perguntava à D4Sign a cada clique — o problema estava do lado de lá.

Direto no painel da D4Sign (o escritório olhou por conta própria): o
documento tinha **seis vagas de assinatura para duas pessoas**. O signatário
do escritório (que tem conta na D4Sign) apareceu três vezes, todas assinadas
— a plataforma absorveu as cópias sem reclamar. O signatário do cliente (sem
conta, `foreign`) também apareceu três vezes, mas só UMA foi completada; as
outras duas ficaram como "Não possui conta" — "a assinar" para sempre, porque
ninguém jamais abriria aqueles links duplicados. Por isso a % de assinatura
nunca fechava, mesmo com as duas partes de verdade já tendo assinado.

A causa: `createlist` da D4Sign **não é idempotente** — cada chamada
ACRESCENTA signatários à lista do documento, nunca substitui os que já
existem. `enviarParaAssinatura`, ao **retomar** um envio que tinha parado no
cofre (`NO_COFRE`), sempre chamava `definirSignatarios` de novo antes de
tentar `mandarAssinar` — e nas últimas 24h esse caminho de retomada foi
percorrido várias vezes, por causa dos dois bugs já corrigidos do
`foresign`/`foreign` e da validação errada do `createlist`. Cada tentativa
teimosa cadastrou os mesmos dois signatários de novo, sem nunca substituir os
anteriores.

Corrigido com um campo novo, `signatariosDefinidosEm` (migração
`20260917120018`): gravado assim que `definirSignatarios` funciona pela
primeira vez, ANTES de tentar `mandarAssinar` — se este falhar e alguém
clicar "tentar de novo", o código agora pula o `createlist` e só repete o
passo que realmente falhou. Dois testes contra o banco de verdade provam
isso: um com `signatariosDefinidosEm` já preenchido (o `fetch` dublado
falharia o teste se `createlist` fosse chamado) e outro sem, confirmando que
o primeiro envio de verdade continua cadastrando os signatários normalmente.

**O documento de teste em si ficou preso** — tem duas vagas fantasmas que
nunca vão ser assinadas, e a integração não apaga nada da D4Sign (pedido do
escritório, 14/09/2026). A saída é manual, pelo painel da D4Sign: usar
"Opções" nas duas vagas "Não possui conta" pendentes daquele documento
específico para cancelá-las ou resolvê-las por lá. Depois disso o portal deve
conferir certo na próxima vez.

**O timbre continuava "quebrado" mesmo depois da marca d'água mais fraca —
a causa de verdade era outra, e agora está corrigida** (16/09/2026). O
escritório voltou a reportar cabeçalho e rodapé "fora do lugar", por cima do
texto do contrato, mesmo depois do ajuste de opacidade abaixo. Reproduzido
localmente gerando um contrato de teste e inspecionando o PDF por dentro (a
árvore de operadores do conteúdo, não só o olho): o Chromium, ao paginar
impressão, repete elemento com `position: fixed` no ritmo da ÁREA ÚTIL da
página (a altura entre as margens, ~22,81cm) — não no ritmo da FOLHA INTEIRA
(29,7cm). O timbre era uma imagem só, do tamanho da folha inteira, presa com
`position: fixed`; cada repetição avançava 22,81cm enquanto a próxima página
física só começava 29,7cm depois, e esse descompasso de 6,89cm por página se
acumulava até o cabeçalho e o rodapé de um ciclo caírem por cima do texto de
outra página — pior quanto mais páginas o documento tinha, exatamente como
reportado.

A correção separa o que é margem do que é área de texto: cabeçalho e rodapé
(as faixas que vivem dentro das margens) saíram do `position: fixed` no corpo
do HTML e passaram a entrar pelo `headerTemplate`/`footerTemplate` do
Chromium — o mecanismo nativo dele para repetir conteúdo em toda página
impressa, imune a esse descompasso. Só a marca d'água central continua em
`position: fixed`, agora do tamanho exato da área útil (22,81cm), o que faz a
repetição coincidir com cada página em vez de brigar com ela. O timbre
original (`src/modelos/timbre.png`) virou três recortes —
`timbre-cabecalho.png`, `timbre-marca-dagua.png`, `timbre-rodape.png` —, pixel
a pixel iguais ao arquivo do escritório, sem redesenhar nada. Detalhes e a
armadilha do "seguro de impressora" do Chromium (um deslocamento fixo de
~15pt que ele aplica ao cabeçalho/rodapé independente da margem pedida) estão
no comentário grande em `src/lib/timbre.ts`.

Conferido depois da correção, inspecionando a mesma árvore de operadores do
PDF: cabeçalho, marca d'água e rodapé saem com a matriz de posição
IDÊNTICA em todas as páginas de um contrato de teste com várias — o sinal de
que não há mais descompasso acumulando. 353 testes.

**Mais uma rodada de defeitos do uso real, todos corrigidos** (16/09/2026) —
sequência direta da rodada anterior, achados assim que o escritório voltou a
testar depois do deploy:

1. **A correção do envio para assinatura tinha uma segunda falha**, essa só
   visível contra a D4Sign de verdade: `definirSignatarios` esperava a
   resposta do `createlist` como um array solto, mas ela vem como
   `{ message: [{ key_signer, email, act, ... }] }` — um objeto por
   signatário confirmado. Com a checagem errada, `Array.isArray(resposta)`
   dava sempre falso e TODO envio passou a ser recusado, mesmo quando a
   D4Sign tinha cadastrado o signatário certinho. Corrigido para olhar
   `resposta.message` e conferir que cada entrada trouxe o `key_signer` — o
   sinal de verdade de que a D4Sign confirmou o cadastro.

2. **"Em casos, clico em excluir e nada acontece."** Três componentes
   tinham a mesma doença: a recusa da exclusão (caso ou cliente com
   andamento/documento) precisa aparecer na tela, mas cada um perdia essa
   mensagem de um jeito diferente — `menu-do-caso.tsx` fechava o menu em vez
   de reabri-lo (mesmo defeito que `menu-do-cliente.tsx` já tinha corrigido,
   só faltou replicar), e os dois botões de exclusão da ficha
   (`excluir-caso-botao.tsx`, `excluir-cliente-botao.tsx`) ficavam presos na
   tela de confirmação, que nunca mostra o motivo da recusa. Os três agora
   saem da confirmação assim que a ação responde, seja qual for o resultado.

3. **A marca d'água do timbre ficou mais fraca.** Ela chegava a 58% de
   escurecimento no arquivo original — forte o bastante para, num contrato
   de várias cláusulas, cruzar no meio de um parágrafo e parecer um traço
   solto no meio do texto (o que o escritório reportou como documento
   "quebrado"). Reduzida a 25% da intensidade original, só na faixa central
   onde ela vive — cabeçalho e rodapé (ambos medidos e conferidos) não foram
   tocados. Ver o comentário em `src/lib/timbre.ts`.

**Três defeitos achados no uso real, todos corrigidos** (16/09/2026):

1. **O envio para assinatura recusava com "This file not have signers"**,
   mesmo a tela mostrando os dois signatários certos. Era um erro de
   digitação de longa data em `src/lib/d4sign.ts`: o campo que diz que o
   signatário é avulso chama-se `foreign` na API da D4Sign, e o código
   mandava `foresign`. A D4Sign aceitava a chamada com HTTP 200 e descartava
   por baixo o objeto malformado — a lista de signatários ficava vazia, e só
   o passo seguinte acusava o problema, sem apontar a causa. Corrigido o
   nome do campo, e `definirSignatarios` passou a conferir que a resposta
   trouxe uma entrada por signatário mandado, em vez de só olhar o status
   HTTP.

2. **"Ver prévia" mostrava uma caixa em branco**, sem erro nenhum, mesmo o
   "gerar e arquivar" de verdade funcionando. `next.config.ts` mandava
   `X-Frame-Options: DENY` em toda rota, e a prévia embute o próprio PDF num
   `<iframe>` da mesma aplicação — `DENY` bloqueia isso mesmo sendo a mesma
   origem, sem avisar o motivo. Trocado para `SAMEORIGIN`, que resolve sem
   abrir mão da proteção contra outro site enquadrar o portal.

3. **Não havia como excluir um cliente que já tinha caso e andamento** — a
   trava de `excluirCliente` está certa por padrão (regra 6: não apagar
   prova de diligência), mas faltava um jeito de resolver quando a decisão É
   apagar mesmo assim, dado de teste incluído. `excluirCliente` ganhou
   `opcoes.forcar`, e só o **ADMINISTRADOR** consegue usá-la — a exclusão
   forçada cai em cascata sobre caso, andamento e documento, e a auditoria
   guarda `forcado: true` com os números exatos do que foi apagado. Na tela,
   forçar exige um popup (`modal-exclusao-forcada-de-cliente.tsx`) que só
   libera o botão depois de digitar o nome do cliente por extenso — no menu
   da lista e no botão "Excluir cliente" da edição. Para o operador, a
   mesma trava aparece como sempre: texto explicando o que existe, sem opção
   de forçar.

**"Esqueci minha senha" está de pé** (16/09/2026), pedido do escritório depois
do primeiro uso real: até aqui, senha esquecida só se resolvia com o
administrador redefinindo pela tela de Usuários. Agora `/entrar` tem o link
"Recuperar acesso", que leva a `/recuperar-senha`.

O desenho é o MESMO da entrada do cliente por CPF/CNPJ (Anexo II, 3.6), de
propósito — um padrão só de recuperação por e-mail no sistema inteiro: seis
dígitos por `node:crypto`, Argon2id no que fica gravado, um código por vez
(pedir outro invalida o anterior), cinco tentativas erradas matam o código,
dez minutos de validade, e a resposta na tela é **sempre a mesma** exista ou
não aquele e-mail no sistema — diferenciar revelaria quem trabalha no
escritório. Só a equipe (operador e administrador) passa por aqui: o cliente
não tem senha para esquecer, ele entra por código de acesso.

Redefinir com o código certo também destrava o bloqueio de 5 tentativas — a
pessoa acabou de provar quem é pelo e-mail, mesmo padrão do "Redefinir senha"
do administrador. `TokenDeRedefinicaoDeSenha` é tabela nova (migração
`20260916175729`), irmã de `CodigoDeAcesso` mas ligada a `Usuario`. 348
testes unitários e 102 contra o banco.

**A busca de endereço pelo CEP está de pé** (16/09/2026) — era o item 1 da
lista de melhorias e o maior ganho de tempo disponível. Digitado o CEP, o
sistema preenche endereço, cidade e UF. Não é só digitação poupada: é em
cidade e UF que o erro custa caro, porque é delas que sai a cidade da
assinatura dos documentos.

A regra é uma só e vale sempre: **a busca preenche campo vazio e não encosta
em campo preenchido**. Quem corrigiu um endereço à mão não vê a correção
sumir por ter mexido no CEP depois. Conferido em produção nos três casos que
importam: cadastro do zero, campo já escrito e CEP inexistente.

O número e o complemento ficam por conta de quem cadastra — o CEP não os
conhece —, e por isso o endereço entra como "Avenida Paulista, ", com a
vírgula esperando. "Avenida Paulista, Bela Vista" pareceria pronto e iria
assim para a procuração, sem número. O bairro vai na dica, para entrar depois
do número, na ordem certa.

**É conveniência, nunca autoridade:** falha de rede, tempo esgotado ou CEP
inexistente devolvem nada, e a tela segue como sempre foi. Cadastrar cliente
não pode depender de um serviço de terceiro estar no ar. O serviço é o
ViaCEP — público, sem chave, sem segredo —, a consulta passa pelo servidor e
exige sessão da equipe, e trocar de fornecedor é mexer só em `src/lib/cep.ts`.

**Armadilha registrada:** o ViaCEP responde **HTTP 200** para CEP inexistente,
com `{"erro":"true"}` — e o `true` vem como **texto**, não como booleano.
Quem tratar só o status ou só o booleano grava endereço vazio no cadastro.

**Passeio de operador em produção** (16/09/2026): o sistema foi dirigido de
ponta a ponta como uma pessoa o usaria, errando de propósito. Funcionou tudo
— pessoa física e jurídica, caso com honorários parcelados, andamento,
procuração e contrato em PDF, pasta e a tela de assinatura (sem enviar). O
caminho de empresa se saiu especialmente bem: pedir procuração sem sócio
vinculado responde "Falta preencher antes de gerar: representante legal da
empresa", com link para resolver.

Quatro defeitos vieram junto, e todos já estão corrigidos e no ar:

1. **O formulário de CASO apagava tudo**, pelo mesmo motivo do de cliente. Era
   o pior dos dois: a regra que mais recusa ali é a da soma das parcelas, que
   só pode falhar DEPOIS de honorários e parcelas preenchidos. Andamento,
   anexo e novo usuário tinham a mesma doença.
2. **A ficha não mostrava cidade e UF** — campo obrigatório sem lugar para
   conferir, e é dele que sai a cidade da assinatura dos documentos.
3. **Concordância de gênero** nas mensagens de campo obrigatório.
4. **O erro antigo escondia a dica ao vivo** do CPF: corrigido o número, a
   tela continuava dizendo "Informe o CPF ou o CNPJ".

**O que ficou como melhoria, por ordem de valor.** Nada disso é obrigação de
contrato; é o que faria diferença no uso diário:

1. ~~Busca de endereço pelo CEP.~~ **FEITA em 16/09/2026** — ver acima.
2. **Uma tela de Documentos de verdade.** Agora que a assinatura existe, a
   pergunta diária é "quais contratos estão aguardando assinatura?", e ela só
   se responde abrindo cliente por cliente.
3. **Estado civil como lista**, não campo livre: vai para documento jurídico e
   em seis meses haverá "solteira", "Solteira" e "SOLTEIRO" no banco.
4. **Não há como remover cliente cadastrado por engano.** O padrão de
   Usuários — desativar, não apagar — serviria.
5. **"anexado por" aparece em documento que o sistema gerou.** Falta
   distinguir gerado de anexado.

**Uma melhoria recusada de propósito:** preencher "brasileira" por padrão na
nacionalidade. Economizaria digitação em quase todo cadastro, mas basta
alguém não trocar num cliente estrangeiro para a procuração sair mentindo. Em
documento assinado, campo em branco que incomoda é melhor que campo
preenchido que mente.

**Há dados de teste em produção** desde 16/09/2026: os clientes Joana Ribeiro
da Silva, Padaria Aurora Ltda e Carlos Aurora de Souza, com um caso, um
andamento e três documentos gerados. Nenhum foi enviado para assinatura —
nenhum crédito foi gasto. Ficam até existir a desativação de cliente (item 4
acima) ou uma limpeza no banco antes da entrega.

**O único caminho não testado de ponta a ponta é o cliente entrando em
`/consultar`**: o código vai por e-mail, e testá-lo exige alguém com acesso a
uma caixa de verdade. A tela responde e o SMTP está provado; falta o ciclo
completo, que é item da demonstração.

**Listas de clientes e de casos ganharam filtros, linha clicável e menu**
(16/09/2026), pedido do escritório. Conferido em produção: filtro por tipo de
pessoa, por acesso ao portal e por ter/não ter caso; a linha inteira abre a
ficha; o menu de cada cliente tem abrir, editar e **excluir**.

A exclusão tem trava: recusa cliente com documento, andamento ou contrato
assinado, e devolve os números do que existe em vez de um "não é possível"
sem explicação. Conferido em produção nos dois lados — cliente vazio sai,
cliente com histórico (a Joana, com 2 documentos e 1 andamento) fica.

Caso agora nasce também da lista de Casos, com o cliente obrigatório no
seletor — sem cliente escolhido a gravação é recusada. Casos ganharam filtro
por situação, responsável (incluindo "sem responsável") e com/sem número de
processo.

**O painel virou visão geral de verdade** (16/09/2026), pedido do
escritório: mais indicadores e clicar num deles filtra NA PRÓPRIA TELA, sem
navegar embora. Os indicadores levam para `/painel?secao=clientes&...` — a
mesma rota do painel, com o filtro na query string — em vez de
`/painel/clientes`. Reaproveita exatamente os filtros construídos para as
listas de Clientes e de Casos: uma lista de regras só.

Três relatórios novos, cada linha clicável levando ao mesmo filtro na
própria tela: clientes por tipo (PF/PJ), acesso ao portal (liberado,
aguardando assinatura, sem e-mail) e casos (em andamento, arquivados, sem
responsável, sem número — pré-processual). Um quarto mostra os envios de
assinatura eletrônica aguardando e assinados, sem link — falta a tela de
Documentos para ter o que filtrar. "Últimos andamentos lançados" continua
sempre visível, embaixo de tudo. Conferido em produção: clicar em "Clientes
cadastrados" e em "Pessoa jurídica" mantém a URL em `/painel` e mostra a
amostra filtrada com a descrição do filtro em texto.

**O primeiro uso de verdade achou três defeitos** (16/09/2026), todos no
caminho mais percorrido do sistema: cadastrar um cliente.

1. **O formulário apagava tudo o que tinha sido digitado.** Só documento,
   telefone e CEP tinham estado; o resto era `defaultValue`. Quando a
   gravação era recusada por falta de um obrigatório, o React reiniciava o
   formulário ao fim da ação e levava junto a ficha inteira. Agora **todo
   campo é controlado**, e um aviso no topo diz quantos faltam e que nada se
   perdeu. Foi o pior dos três: punia justamente quem estava preenchendo com
   capricho.

2. **Não dava para saber o que era obrigatório sem tentar salvar.** Os
   obrigatórios ganharam **asterisco**, e a lista que decide isso é a MESMA
   que o servidor usa para recusar — saiu de `clientes.ts` para
   `src/lib/campos-do-cliente.ts`, que é seguro para o navegador. Duas
   listas se desencontrariam no primeiro campo que alguém tornasse
   obrigatório, e o jeito de descobrir seria um operador preenchendo tudo o
   que tem asterisco e o sistema recusando assim mesmo. Há teste cruzando as
   duas pontas, campo por campo, nos dois tipos de pessoa.

   Os asteriscos mudam com o documento digitado: incompleto, a tela assume
   pessoa física (a lista mais exigente); completado um CNPJ, os da
   qualificação pessoal somem — são do sócio, não da empresa.

3. **"Alguma coisa não funcionou aqui" ao salvar.** Não era defeito do
   cadastro: era a aba com a **versão anterior** carregada. As ações de
   servidor do Next são identificadas por um código que muda a cada
   publicação, e a que aquela aba conhecia não existia mais no servidor.
   Nada foi gravado, mas a mensagem não dizia isso e "tentar de novo" falhava
   igual, porque `reset()` refaz a tela com o mesmo código velho. A
   barreira de erro passa a reconhecer o caso e a dar o único conselho que
   resolve: recarregar a página.

   **Isto vai acontecer a cada publicação** com o sistema em uso. Publicar
   fora do horário de trabalho do escritório é o jeito de ninguém perder
   ficha nenhuma.

**368 testes** (300 unitários, 68 contra o banco).

**A HOMOLOGAÇÃO não assina mais em produção** (16/09/2026). `D4SIGN_TOKEN_API`
está vazia lá, por decisão do fornecedor; a crypt key e o cofre continuam
configurados, porque sozinhos não assinam nada e guardá-los poupa trabalho
quando chegar um token de sandbox. Sem token, o portal de homologação
simplesmente não assina e a tela explica. O risco registrado acima está
**fechado**.

**PRODUÇÃO está com o código novo** (16/09/2026, commit `596e934`). Antes
disso ela rodava o commit de 14/09 e estava **sete commits atrás** — sem a
tela de Usuários e sem a assinatura eletrônica. Conferido entrando no painel:
`/painel/usuarios`, `/painel/api` e `/painel/clientes` respondem 200.

A migração `20260915151745_assinatura_eletronica` subiu junto, e isso não é
suposição: o `CMD` do Dockerfile encadeia
`migrate deploy && prisma:semear && start` com `&&`, então uma migração
falhada impediria a aplicação de subir. Ela está servindo.

**O EasyPanel NÃO faz deploy automático no push.** A origem é um repositório
git comum, não a integração do GitHub: depois de cada `git push` alguém
precisa disparar o deploy no painel, ou o que está no ar continua velho — foi
exatamente o que aconteceu entre 14 e 16/09.

**HOMOLOGAÇÃO continua no commit de 14/09**, de propósito: ela ainda está com
o token de PRODUÇÃO da D4Sign (ver o risco aberto, acima), e publicar a tela
de assinatura lá antes de resolver isso é dar um botão que gasta crédito de
verdade num ambiente chamado "testes".

**A assinatura eletrônica está de pé** (15/09/2026), fechando a Sprint 3 e a
dependência 3.4. O ciclo agora vai de ponta a ponta: gerar, enviar, o cliente
assina no e-mail, o PDF assinado volta para a pasta e — sendo o contrato — o
acesso ao portal se abre **sozinho**, que é o gatilho do Anexo I, 1.d. O cartão
"Acesso do cliente" continua existindo para o contrato assinado em papel.

**Em produção não há ensaio**, e o desenho inteiro gira em torno disso: cada
envio gasta um crédito do escritório (Cláusula 6ª) e manda e-mail de verdade,
sem desfazer. Por isso gerar não envia; o envio tem tela de confirmação com o
endereço de cada signatário e o saldo à vista; a confirmação tem dois cliques;
e conferir se já assinaram é leitura, que não custa nada.

**Nada apaga nada no cofre do escritório** (pedido de 14/09/2026). Não há
chamada de exclusão, e um envio que sobe o PDF e falha antes de sair vira
`NO_COFRE` em vez de sumir — a tela diz que aquele PDF ficou lá, que nenhum
e-mail saiu e que nenhum crédito foi gasto, e tentar de novo **reaproveita** o
documento em vez de subir outra cópia.

O documento original **não é substituído** pelo assinado: ficam os dois na
pasta. Sobrescrever pouparia uma linha na tela e destruiria a única forma de
conferir, depois, que o que foi assinado é o que foi mandado.

**334 testes** (266 unitários, 68 contra o banco). Os novos cobrem quem assina
cada documento — inclusive que a pessoa jurídica manda para o sócio e não para
a empresa —, todas as recusas que acontecem **antes** de gastar um crédito, e
que o token e a `cryptKey` não vazam na mensagem de erro (a D4Sign autentica
pela query da URL e ecoa a URL em alguns erros — regra 8).

**A tela de Usuários está de pé** (14/09/2026), fechando o que faltava da
Sprint 5 (dependência 3.7). Só o administrador acessa `/painel/usuarios` —
`exigirAdministrador` decide isso no domínio (`src/lib/usuarios.ts`), a tela só
evita o erro feio para o operador, mesmo padrão da tela da API.

"Excluir" aqui é desativar, não apagar a linha: `autorId` de andamento,
`criadoPorId` de cliente e a auditoria toda apontam para o usuário, e regra 6
exige que esse rastro continue dizendo quem fez o quê mesmo depois que a
pessoa sai do escritório. Desativado, o usuário para de entrar (a checagem já
existia em `src/auth.ts`) — o efeito prático de "excluir" sem quebrar o
histórico. Reativar desfaz.

A senha **não é digitada pelo administrador** — o sistema sorteia (mesma
lógica de `prisma/seed.ts`, agora compartilhada em `gerarSenhaAleatoria`,
`src/lib/senha.ts`) e aparece na tela **uma vez só**, igual à chave de API em
`credenciais.ts`. "Redefinir senha" segue o mesmo caminho e de quebra destrava
quem estivesse bloqueado pelas 5 tentativas erradas.

A tela só alcança quem tem e-mail e é operador ou administrador — de propósito
fora do alcance: o perfil CLIENTE (gerido pelo cartão "Acesso do cliente" na
ficha do cliente) e os usuários sem e-mail que só existem para uma credencial
de API assinar andamentos (geridos em `/painel/api`).

**O escritório não pode se trancar para fora do próprio painel:** rebaixar ou
desativar o único administrador ativo é recusado (`ultimo_administrador`),
com teste de banco dedicado.

240 testes unitários verdes (`npm run test`) e `npx tsc --noEmit` limpo. Os
testes de banco de `testes-de-banco/usuarios.teste.ts` foram escritos no mesmo
padrão dos demais (violação real de unicidade de e-mail, o filtro que
exclui CLIENTE e credencial de API, a trava do último administrador) mas
**não puderam ser executados nesta sessão**: o Postgres local (`docker compose
up -d banco`) subiu e respondeu a `psql` dentro do próprio contêiner, mas a
conexão vinda do host nunca chegou a ele (nenhuma linha de log do lado do
banco) — sintoma de rede do Docker Desktop neste ambiente, não do código.
Rodar `npm run test:banco` para confirmar assim que a rede estabilizar.

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

**A identidade visual entrou de verdade** (14/09/2026). O papel timbrado do
escritório estava dentro do `.docx` da procuração nova — imagem de página
inteira, com monograma, marca d'água e contatos no pé. É ele que vai atrás de
todo documento gerado, em todas as páginas, com as margens do arquivo
original. O timbre saiu dos modelos e vive em `src/lib/timbre.ts`, porque o
que está em `src/modelos/` é texto jurídico do escritório e a regra 10 proíbe
encostar nele.

**A procuração foi reescrita sobre o modelo novo do escritório**, com duas
variantes: pessoa física e pessoa jurídica. Na de PJ a empresa e o sócio não se
fundem mais — a empresa entra com razão social e CNPJ, o sócio logo depois com
nome, RG e CPF próprios. O texto dos poderes é um só, em arquivo único.

**A prévia passou a ser o PDF de verdade**, aberto no visualizador do
navegador. Enquanto era HTML contínuo, ela não mostrava onde cada página
termina e a assinatura aparecia por cima do rodapé impresso — defeito que só
existia na prévia. Ver `docs/modelos-de-documento.md`.

**O cadastro ganhou cidade e UF**, obrigatórios: é do cliente que sai a cidade
da assinatura dos documentos, por decisão do escritório.

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

**A aplicação já está publicada e no ar em produção**
(`https://portal.eferreira.adv.br` — ver `docs/03-implantacao-easypanel.md`),
o **SMTP está resolvido de ponta a ponta** e o **D4Sign também**: token e
crypt key de produção conferidos com `npm run d4sign:conta`, cofre
"Escritorio" batendo com `D4SIGN_COFRE`. Próximo passo: a **Sprint 6** —
demonstração, aceite e produção. O que ainda falta de terceiros: o registro
de DNS de `homologacao.eferreira.adv.br` e o backup automático do Postgres
em produção com o teste de restauração repetido lá.
