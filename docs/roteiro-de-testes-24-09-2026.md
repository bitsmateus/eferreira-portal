# Roteiro de testes — mudanças de 22 a 24/09/2026

Para conferir com calma, depois do deploy. Marque cada item. Onde disser
**(D4Sign)**, gasta crédito e manda e-mail de verdade: use só um e-mail do
próprio escritório.

Antes de tudo: disparar o **deploy manual no EasyPanel** (ele não puxa sozinho
do GitHub) e, com o sistema em uso, avisar que quem estiver com a tela aberta
precisa recarregar a página.

---

## 0. O que é SEU (fazer ou testar) — só as alterações de 24/09

**Fazer**
- [ ] **Deploy manual no EasyPanel.** Aplica sozinho as migrações novas
      (`empresa_vinculada_ao_caso`, `posicao_das_assinaturas`). Depois, abrir
      `/painel` e conferir que carrega.
- [ ] Quem estiver com tela aberta na hora precisa **recarregar a página**.
- [ ] **Posição da assinatura:** no cofre "Escritorio" (Opções do cofre →
      Configurações) NÃO existe a opção "Ativar posição da assinatura" — só
      Autenticações, Definir limite, Assinatura guiada, Lembretes,
      Permissões, Webhook, Callback e D4Sign.AI (conferido em 24/09). Não
      ligar "Assinatura guiada" (é outra coisa). Escrever ao Suporte da
      D4Sign perguntando como habilitar o `addpins` (posição por API) nesse
      cofre — ou testar direto, que pode funcionar sem a opção. Só então
      `D4SIGN_POSICIONAR_ASSINATURA=1` (seção 7).

**Testar** — as seções 1 a 7 abaixo. O que só você consegue:
- [ ] Gerar de verdade os documentos (seção 1) e comparar com os do escritório.
- [ ] Portal da empresa vinculada (seção 3): exige um contrato assinado
      registrado e e-mail cadastrado na empresa.
- [ ] Envio de teste pela D4Sign (seção 7): gasta 1 crédito.

**Perguntar ao escritório** (os pontos abertos das alterações de hoje)
- [ ] Contrato de **pessoa jurídica** e de **assistida** derivados das
      procurações: ok? (o arquivo deles só trouxe pessoa física)
- [ ] Item **3.5** do contrato: a conta e o Pix do contrato antigo valem?
- [ ] Mandar os "formatos específicos" de objeto e honorários sem a
      numeração 3.1–3.4?
- [ ] "(a)" no lugar do masculino e "4º andar" (os modelos dizem "4ª"): ok?
- [ ] A empresa vinculada pode ver os documentos do cliente final? (hoje só
      vê casos e andamentos)
- [ ] Cliente pode ter mais de uma empresa de origem? Há repasse ou comissão
      (financeiro, fora do contrato)?
- [ ] Contrato de menor/assistido deve citar o assistente? (hoje cita)

---

## 1. Documentos gerados (procuração, declaração, contrato)

Em **Clientes → ficha → Gerar documento**.

- [ ] **Timbre:** cabeçalho (logo), marca d'água central e rodapé aparecem
      como no papel do Word do escritório, sem tocar o texto, em todas as
      páginas do contrato.
- [ ] **Procuração PF** cabe em **uma página** (como a do escritório), com
      nome em negrito e os trechos dos poderes em negrito.
- [ ] **Procuração PJ:** empresa e representante legal lado a lado; assinatura
      com razão social, CNPJ e "Representada por: …".
- [ ] **Procuração "representada/assistida":** vincule um responsável (cartão
      "Responsável legal (cliente menor de idade)" na ficha de uma pessoa
      física) e gere. O menor entra só com nome, nacionalidade, RG e CPF; o
      assistente com a qualificação completa.
- [ ] **Declaração PF** e **declaração assistida**: texto novo (arts. 98 e 99
      do CPC). Para uma **empresa**, a tela deve avisar que não há modelo.
- [ ] **Contrato** (PF, PJ e assistida): onze cláusulas, numeração de 1ª a
      11ª sem repetição, foro de Mogi das Cruzes, item 3.5 com a conta de
      pagamento. Confira as quatro modalidades de honorários (uma, duas ou
      todas) e as cinco variações de objeto.
- [ ] **Outorgado:** trocar entre Dr. Sergio e Dra. Cristina no seletor;
      concordância muda (OUTORGADA, "sua bastante procuradora"), e o e-mail e
      telefone citados são os do escritório.
- [ ] **Faltando dado:** gerar com cadastro incompleto diz exatamente o que
      falta e leva ao cadastro certo (o do assistente, quando é dele).
- [ ] Sobre o texto, o escritório deve conferir: variantes PJ/assistida do
      **contrato** (derivadas), item **3.5** (conta do contrato antigo),
      "(a)" no lugar do masculino, "4º andar" (os modelos deles dizem "4ª").

## 2. Cadastro

- [ ] **Pessoa física:** obrigatórios com asterisco = nome, nacionalidade,
      estado civil, profissão, RG, CPF, e-mail, telefone, endereço, CEP,
      cidade, UF. Nome da mãe é opcional.
- [ ] **Pessoa jurídica:** obrigatórios = endereço, CEP, cidade, UF (e-mail e
      telefone da empresa não). No representante legal, profissão é opcional.
- [ ] Empresa sem e-mail: a ficha avisa que o acesso ao portal não é liberado.

## 3. Empresa vinculada ao caso

- [ ] **Novo caso / editar caso:** campo "Empresa vinculada (opcional)" com
      busca por nome ou CNPJ; só aparecem empresas (pessoa jurídica).
- [ ] **Lista de Casos:** filtro "Empresa vinculada", coluna "Empresa", e a
      busca acha pelo CNPJ ou nome da empresa.
- [ ] **Ficha do caso:** mostra a empresa (link). **Ficha da empresa:**
      cartão "Casos ligados a esta empresa" com o link "ver na lista de casos".
- [ ] **Portal da empresa** (contrato assinado + e-mail cadastrado): entra em
      `/consultar` com o CNPJ; vê os casos **ligados a ela** e os andamentos;
      **não vê** documentos do cliente final; não vê caso de outra empresa.
      Confirmar com o escritório que é isso que querem.
- [ ] **Portal de uma pessoa física** continua vendo só os próprios casos.

## 4. Usuários

- [ ] **Administrador → Usuários:** cadastrar com senha digitada (mín. 8) e
      com o campo em branco (o sistema sorteia e mostra uma vez).
- [ ] **Redefinir senha** com senha digitada e sem digitar.
- [ ] **Minha conta** (menu, qualquer usuário): trocar nome; trocar e-mail ou
      senha só com a senha atual correta. Operador não altera perfil nem vê a
      tela de Usuários.

## 5. Telas menores

- [ ] **Honorários fixos:** seletor de forma de pagamento (À vista, Pix,
      Transferência/TED, Boleto) e de quantidade de parcelas (1 a 12); só
      aparecem as linhas escolhidas. A forma entra no texto do contrato.
- [ ] **Busca ao escolher** cliente (Novo caso) e caso (Anexar documento,
      Gerar documento): digitar e selecionar.
- [ ] **WhatsApp:** botão verde no canto inferior direito de `/consultar` e
      `/meus-processos`, abrindo a conversa com a mensagem pronta.
- [ ] **Empresa ↔ representante:** ficha do sócio mostra "Representa".

## 6. API

- [ ] `GET /api/v1/consulta/empresa?documento=<CNPJ>` com uma chave de teste
      (homologação): devolve os casos ligados, cada um com o cliente.
- [ ] `GET /api/v1/consulta?documento=…` traz `empresa` em cada caso.

## 7. Posição da assinatura na D4Sign — desligada por padrão **(D4Sign)**

Só depois de todo o resto. Nada disto muda enquanto
`D4SIGN_POSICIONAR_ASSINATURA` estiver vazia.

1. [ ] Perguntar ao Suporte da D4Sign (botão "Suporte", no topo do painel):
       "Como habilito o posicionamento de assinatura via API (`addpins`) no
       cofre Escritorio? Não encontro 'Ativar posição da assinatura' em
       Configurações." Se disserem que funciona sem opção nenhuma, seguir.
2. [ ] `npm run d4sign:posicoes -- arquivo.pdf` num PDF gerado: confere as
       posições e os pins que seriam enviados (não fala com a D4Sign).
3. [ ] Ligar `D4SIGN_POSICIONAR_ASSINATURA=1` (produção, ou só localmente com o
       token de produção — a homologação não assina).
4. [ ] Enviar **um contrato** e **uma procuração** para um e-mail do escritório
       e abrir o link: o carimbo cai sobre a linha de assinatura?
5. [ ] Se cair deslocado, acertar `D4SIGN_PIN_AJUSTE_X_MM` (horizontal) e
       `D4SIGN_PIN_AJUSTE_Y_MM` (vertical), em milímetros, e repetir. Padrão:
       -20 e -14.
6. [ ] **Documento avulso:** enviar um anexo com duas pessoas e conferir
       página, lado e altura escolhidos na tela ("Onde cada um assina").
7. [ ] Se algo der errado no meio, o envio para **antes de cobrar** e a tela
       diz que ficou no cofre; "tentar de novo" não duplica signatários.
