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
  no banco de produção não é ambiente de testes"). Duas saídas: um token de
  sandbox da D4Sign para a homologação, ou **deixar `D4SIGN_TOKEN_API` vazio
  lá** — sem token a instalação simplesmente não assina, e a tela explica.
  Decisão do escritório; enquanto não vier, não testar assinatura em
  homologação.
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

### O que ainda falta perguntar

1. **O bloco de pessoa física da procuração precisa de conferência.** Ele não
   veio no arquivo novo, que é de cliente PJ; foi mantido o texto do modelo
   anterior do escritório, encaixado no texto novo.
2. **A declaração e o contrato continuam com o texto antigo.** Se a procuração
   foi reescrita, os outros dois talvez também precisem de versão nova.
3. **A cláusula 9ª repetida** continua no contrato que vai para assinatura.
   Registrado que é para seguir assim, mas o defeito é deles.

### A senha do D4Sign

O escritório decidiu **manter** a senha que trafegou em texto puro no WhatsApp
("vai ser essa mesma"). A recomendação de trocá-la foi feita e fica registrada
aqui. O sistema não usa essa senha — a integração vai pelo token de API —, então
o risco é do painel do D4Sign do escritório, não do portal.

**Enquanto uma dependência não responder: não invente conteúdo para destravar.**

## Estado atual

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
