# Assinatura eletrônica — como funciona e por quê

Anexo II, item 3.4, resolvido: **D4Sign**. Entregue em **15/09/2026**, fechando
o que a Sprint 3 deixou pela metade.

---

## O que mudou

Antes, o sistema gerava o PDF e parava ali. A assinatura acontecia fora dele, e
alguém do escritório digitava a data na ficha do cliente para destrancar o
portal.

Agora o ciclo fecha sozinho:

```
gerar → enviar → o cliente assina no e-mail → o PDF assinado volta para a
pasta → e, se for o contrato, o acesso ao portal se abre
```

Aquele último passo é o **Anexo I, 1.d**. Ninguém precisa mais digitar data
nenhuma — embora o cartão "Acesso do cliente" continue existindo, porque
contrato assinado **em papel** também existe.

---

## Em produção não há ensaio

Esta é a única coisa desta página que precisa ser lida antes de usar.

O escritório tem token de **produção**. A D4Sign não tem modo de teste dentro
dele. Portanto, **todo envio**:

1. **consome um crédito** da conta do escritório — custo de terceiro, da
   Cláusula 6ª do contrato, não do desenvolvimento;
2. **manda e-mail de assinatura de verdade** para quem estiver na lista.

Nada disso se desfaz. Não há "cancelar antes que chegue".

É por isso que o desenho é o que é:

- **gerar um documento não envia nada.** São dois botões diferentes, em dois
  momentos diferentes.
- **o envio tem tela de confirmação**, com o endereço de cada signatário à
  vista e o saldo de créditos ao lado. São as três coisas que alguém quer
  conferir antes e não consegue mais depois.
- **a confirmação tem dois cliques.** O primeiro só abre o aviso.
- **a conferência é de graça.** Perguntar à D4Sign se já assinaram é leitura:
  não custa crédito e não manda e-mail.

Para ver o saldo sem abrir o sistema: `npm run d4sign:conta` — só leitura.

---

## Quem assina o quê

| Documento | Quem assina |
|---|---|
| Procuração | só o cliente |
| Declaração | só o cliente |
| Contrato | o cliente **e** o escritório |
| Anexo | ninguém — não vai para assinatura |

**Procuração e declaração são declarações do cliente.** O escritório é
destinatário delas, não parte que assina. O contrato é bilateral.

**Pessoa jurídica não assina: quem assina é o representante legal.** O e-mail
vai para o endereço do sócio; se ele não tiver um no cadastro, vale o da
empresa. Mandar o documento para a empresa em vez do sócio seria pedir
assinatura de quem não pode dar.

**Quem assina pelo escritório** é o advogado, e não a conta que manda os
e-mails do portal. São dois endereços diferentes e é de propósito — ver
`D4SIGN_EMAIL_DO_ESCRITORIO` no `.env.example`.

**As testemunhas do contrato ficam no papel.** O modelo do escritório tem as
linhas delas, e elas não entram na assinatura eletrônica: cada testemunha
seria mais um endereço a cadastrar e mais uma pessoa a esperar para o
documento fechar. Combinado em 14/09/2026 — **confirmar na demonstração**.

---

## O caminho na tela

1. Na **pasta do cliente**, todo documento gerado que ainda não foi assinado
   tem o botão **Assinar**.
2. A tela mostra quem vai receber, em que endereço, e quantos créditos restam.
3. **Enviar para assinatura** → confirmar. O e-mail sai na hora.
4. A pasta passa a mostrar **Aguardando assinatura**.
5. **Ver assinatura** → **Conferir agora** pergunta à D4Sign. Enquanto ninguém
   assinou, a resposta é "ainda não assinaram. Nada mudou".
6. Assinado: o PDF volta para a pasta como *"… (assinado).pdf"*, e o original
   ganha a etiqueta **Assinado**.

### Por que perguntar, em vez de esperar um aviso

A D4Sign sabe chamar um endereço nosso quando o documento fecha (webhook). Isso
exigiria duas coisas que não estão nas nossas mãos: **alguém configurando o
webhook no painel do escritório** e **um endereço público deste portal
aceitando requisição de fora, sem sessão** — que é superfície nova, e a regra 2
diz que nenhuma decisão de acesso depende do que chega de fora.

Perguntar funciona sem depender de ninguém e não custa nada. Se o escritório
quiser o aviso automático depois, ele entra **por cima** disto, chamando a
mesma `conferirAssinatura`.

---

## O documento original não é substituído

Ficam os dois na pasta: **o que foi enviado** e **o que voltou assinado**.

Sobrescrever pouparia uma linha na tela e destruiria a única forma de conferir,
depois, que o que foi assinado é o que foi mandado. Em documento que vira
prova, isso não se troca por arrumação.

---

## Nada aqui apaga nada

O cofre usado é o **"Escritorio"**, que já existia e tem documentos de clientes
reais. O pedido de 14/09/2026 foi expresso: *"apenas não exclua nada que tem
ali"*.

Por isso:

- **não existe chamada de exclusão** em `src/lib/d4sign.ts` — nem de documento,
  nem de cofre, nem de signatário — e não deve passar a existir;
- um envio que falha no meio do caminho **não some**: vira `NO_COFRE`.

### O estado `NO_COFRE`, e por que ele existe

Há uma falha possível e feia: o PDF sobe para o cofre e o passo seguinte — a
lista de signatários, ou o envio — é recusado. O documento **fica lá**, e não
pode ser apagado.

Sem esse estado, ele sumiria do sistema e continuaria existindo no cofre do
escritório, sem ninguém saber de onde veio. Com ele:

- a pasta mostra **Não enviado**;
- a tela diz que o PDF está no cofre, que **nenhum e-mail saiu** e que
  **nenhum crédito foi gasto**;
- **tentar de novo reaproveita** o documento que já está lá, em vez de subir
  outra cópia. É o mais perto de "limpar" que dá para chegar sem apagar.

---

## O que o sistema recusa antes de gastar um crédito

| Situação | O que acontece |
|---|---|
| Documento é anexo, ou é o próprio PDF assinado | não vai para assinatura |
| Documento já está assinado | recusa |
| Já existe envio aguardando | recusa — dois envios, dois créditos, dois links |
| Falta e-mail de quem assina | recusa, e diz de quem |
| Conta sem créditos | recusa |
| D4Sign não configurada nesta instalação | a tela explica, e o cartão de acesso manual continua valendo |

Tudo isso é conferido **de novo no servidor** no momento do clique, e não só na
tela: entre abrir a página e apertar o botão, o cadastro pode ter mudado
(regra 2).

Provado em `testes-de-banco/assinatura-eletronica.teste.ts`, contra o Postgres
de verdade e sem tocar a rede.

---

## O rastro (regra 6)

Cada envio grava **quem mandou, para quais endereços, em qual cofre e quando**
— é esse registro que responde "quem gastou o crédito" e "para qual endereço
este contrato foi". A chegada do assinado grava outro, com a origem
`assinado_na_d4sign`.

A tabela `envio_para_assinatura` guarda o histórico de tentativas de cada
documento; uma recusada não apaga a anterior.

---

## As credenciais não podem ir para o log

A D4Sign **não** autentica por cabeçalho: o token e a `cryptKey` vão dentro da
query da URL. E em alguns erros ela devolve a própria URL chamada — o que
colocaria as duas credenciais no log do servidor, que é lido por mais gente do
que cofre (regra 8).

Por isso `src/lib/d4sign.ts` limpa toda mensagem de erro antes de deixá-la
sair, e há teste dedicado a isso: se a limpeza for removida, a suíte fica
vermelha.

O endereço temporário do PDF assinado recebe o mesmo tratamento — ele dá acesso
ao documento e não aparece em mensagem de erro nenhuma.

---

## Configuração

```
D4SIGN_URL="https://secure.d4sign.com.br/api/v1"
D4SIGN_TOKEN_API=          # secreto no EasyPanel
D4SIGN_CRYPT_KEY=          # secreto no EasyPanel
D4SIGN_COFRE=              # UUID do cofre "Escritorio"
D4SIGN_EMAIL_DO_ESCRITORIO=  # em branco = o advogado da procuração
```

Sem token, a instalação simplesmente **não assina**: a tela explica e o cartão
"Acesso do cliente" continua sendo o caminho. Não é erro — é o estado normal de
um ambiente que ainda não integrou.

Para conferir o que está configurado, sem gastar nada:

```
npm run d4sign:conta
```

---

## O que ainda depende do escritório

1. **Confirmar quem assina cada documento.** O escritório respondeu *"não sei
   te dizer, faça e depois confirmo com o cliente"* — a tabela acima é a
   proposta, e ela precisa de um "sim" na demonstração.
2. **Confirmar que as testemunhas ficam no papel.**
3. **O primeiro envio de verdade** ainda não foi feito. Ele gasta um crédito e
   manda e-mail real: o primeiro deve ir para um endereço do próprio
   escritório, não de cliente.
