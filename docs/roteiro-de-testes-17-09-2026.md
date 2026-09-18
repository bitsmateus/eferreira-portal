# Roteiro de testes — reunião de 17/09/2026

Cobre os cinco pedidos da demonstração: representante legal obrigatório,
nome da mãe opcional, botão de WhatsApp, honorários de êxito/proveito
econômico e cadastro de partes com assinatura de documento avulso.
Commit `6780870`, já no `main`.

**Antes de testar:** este código ainda não está em produção — o EasyPanel não
faz deploy automático no push. Para testar localmente, o banco já está
migrado (as duas migrações rodaram nesta sessão). Para testar em produção ou
homologação, é preciso disparar o deploy manualmente no painel do EasyPanel
primeiro (ele roda `prisma migrate deploy` na subida).

---

## 1. Representante legal obrigatório ao cadastrar pessoa jurídica

1. `/painel/clientes/novo` → digite um CNPJ válido (ex.: `11.222.333/0001-81`).
2. Ao completar os 14 dígitos, deve aparecer uma seção **"Representante
   legal"** dentro do mesmo formulário, com campos próprios: CPF do sócio,
   nome, RG, estado civil, profissão, nacionalidade, nome da mãe (opcional),
   e-mail e telefone.
3. Tente salvar **sem preencher** os campos do representante → deve recusar
   e apontar exatamente o que falta (mensagens tipo "O RG do representante
   legal é obrigatório").
4. Preencha tudo e salve → deve criar a empresa **e** o sócio, e abrir a
   ficha da empresa já mostrando o sócio em "Representantes legais".
5. **Teste do reaproveitamento (regra 4):** cadastre uma segunda empresa
   usando o **mesmo CPF** de sócio já usado no passo 4 → não deve duplicar o
   cliente pessoa física; a ficha da segunda empresa deve mostrar o mesmo
   sócio, e `/painel/clientes` deve continuar com só um registro daquele CPF.
6. **Teste de recusa:** tente usar como "CPF do sócio" o **CNPJ de uma
   empresa já cadastrada** → deve recusar com mensagem dizendo que aquele
   documento pertence a uma pessoa jurídica.
7. Confirme que **editar** uma empresa já existente não pede representante
   de novo (a seção de representante só aparece no cadastro **novo**) — quem
   adiciona ou troca sócio depois é a tela "Representantes legais" na ficha,
   que continua como estava.

## 2. Nome da mãe deixou de ser obrigatório

1. `/painel/clientes/novo` com um CPF → note que "Nome da mãe" não tem mais
   asterisco.
2. Preencha tudo, exceto nome da mãe, e salve → deve aceitar normalmente.
3. Mesmo teste no campo de representante legal (dentro do cadastro de uma
   empresa) → nome da mãe do sócio também opcional.

## 3. Botão "Fale conosco pelo WhatsApp"

1. Saia da sessão e vá para `/consultar` (tela do cliente, não `/entrar`) →
   deve aparecer o link "Fale conosco pelo WhatsApp" abaixo do formulário.
   Clique e confirme que abre `wa.me/5511945803696` (o número
   `(11) 4580-3696`).
2. Entre como cliente em `/meus-processos` → deve aparecer "Fale conosco" no
   cabeçalho, ao lado do nome do cliente logado.
3. **Confirmar com o escritório:** este número é diferente do WhatsApp já
   cadastrado no sistema para a procuração (`11 93806-3696`, pessoal do
   advogado). Vale confirmar se são dois números mesmo, ou se um dos dois
   está desatualizado.

## 4. Honorários — êxito e percentual sobre proveito econômico

1. `/painel/casos/novo` (ou editando um caso existente) → na seção
   "Honorários", agora tem três campos: valor fixo (como já era), "Honorários
   de êxito (%)" e "Sobre o proveito econômico (%)".
2. Digite um percentual fora da faixa (ex.: `5` ou `35`) → deve recusar,
   exigindo de 10 a 30.
3. Digite um percentual com casa decimal (ex.: `20,5`) → deve recusar,
   pedindo número inteiro.
4. Preencha só o percentual de êxito (sem valor fixo) e salve → deve aceitar
   normalmente. Repare no aviso amarelo que aparece no formulário avisando
   que o contrato ainda não sai com essa modalidade.
5. **O ponto mais importante deste item:** com o percentual preenchido, vá
   gerar o contrato desse caso (`/painel/clientes/[id]/gerar`) → deve
   **recusar**, com uma mensagem dizendo que falta o texto da cláusula e
   sugerindo remover o percentual para gerar agora só com o fixo.
6. Confirme que **procuração** e **declaração** continuam gerando normalmente
   para esse mesmo cliente, mesmo com o caso tendo percentual — a trava é só
   do contrato.
7. Apague o percentual, deixe só honorários fixos → gerar o contrato deve
   voltar a funcionar como sempre funcionou.

**Pendência deste item:** falta o escritório mandar o texto da cláusula 2ª
para as duas modalidades novas (e para quando elas se combinam com o fixo).
Sem isso, o contrato de um caso com êxito ou proveito econômico **não sai** —
de propósito, para não inventar texto jurídico.

## 5. Cadastro de Partes + assinatura de documento avulso

1. No menu lateral, deve aparecer um item novo **"Partes"**, entre Casos e
   Documentos. Abra `/painel/partes`.
2. Cadastre uma parte de teste: nome, papel (Advogado / Parte contrária /
   Testemunha / Outros), e-mail obrigatório, telefone e observações
   opcionais. Confirme que aparece na lista à direita.
3. Exclua a parte de teste pelo botão "Excluir" (pede confirmação) → some da
   lista.
4. Vá à pasta de um cliente qualquer e anexe um documento (tipo "Anexo").
5. Na lista de documentos, o anexo agora deve ter um botão **"Assinar"** (não
   tinha antes).
6. Clique em "Assinar" → em vez do fluxo normal de assinatura, deve aparecer
   uma tela para **escolher quem assina**: uma lista de partes cadastradas
   (com caixinha de marcar) e um formulário para adicionar alguém na hora
   (nome, e-mail, papel), sem precisar cadastrar.
7. Marque uma parte e/ou adicione alguém na hora, clique em **"Revisar
   envio"** → deve mostrar a lista final de quem vai assinar e quantos
   créditos restam na conta da D4Sign.
8. **NÃO clique em "Confirmar o envio" a não ser que a intenção seja mesmo
   mandar de verdade** — isso gasta um crédito real da D4Sign e manda e-mail
   de assinatura de verdade para o endereço escolhido, exatamente como já
   acontece com contrato/procuração/declaração. Para testar só a tela, pare
   no passo 7.
9. Confirme que gerar/assinar **contrato, procuração e declaração** continua
   exatamente como antes — a novidade é só para documento do tipo Anexo.

**Pendência avisada, não esquecida:** isto reverte, só para documento avulso,
uma decisão de 14/09/2026 que mantinha testemunha eletrônica fora da D4Sign.
Vale uma confirmação explícita do escritório de que é isso mesmo que querem,
já que testemunha em contrato/procuração/declaração continua de fora.

---

## O que ainda falta (não implementado nesta rodada)

- **Texto da cláusula de honorários de êxito e de proveito econômico** — ver
  item 4 acima. Sem o texto do escritório, o contrato dessas modalidades não
  sai. Precisa vir por escrito, com a redação que o escritório quer usar.
- **Confirmação dos dois números de WhatsApp** — ver item 3.
- **Posição fixa da assinatura no PDF** (item 7 da lista original) — a
  D4Sign tem um endpoint que permite isso, mas não foi implementado ainda.
  Fica para a próxima rodada: para os documentos que o próprio sistema gera
  (contrato, procuração, declaração) dá para fixar automaticamente; para
  documento avulso precisaria de uma tela para marcar a posição na prévia do
  PDF, o que é trabalho de UI a mais.
- **Deploy em produção** — o commit `6780870` está no `main` do GitHub, mas
  o EasyPanel não sobe sozinho. É preciso disparar o deploy manualmente, nos
  dois ambientes que forem receber esta versão.
- **Confirmação com o suporte da D4Sign** sobre o item 7, que ainda não foi
  aberta — só pesquisei a documentação pública deles, não abri chamado.
