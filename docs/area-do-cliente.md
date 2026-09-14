# Área do cliente — como funciona e por quê

Sprint 4, entregue em **14/09/2026**. Cobre o Anexo I, itens 1.d e 2.4, e
fecha o Anexo II, item 3.6.

---

## O caminho do cliente, em quatro passos

1. Ele abre o portal e cai em `/consultar`.
2. Digita o **CPF ou CNPJ**. O sistema responde sempre a mesma coisa: *"se
   estiver cadastrado e o contrato já tiver sido assinado, um código foi
   enviado"*.
3. Se ele for mesmo cliente com contrato assinado, chega um código de **seis
   dígitos** no e-mail do cadastro, válido por **10 minutos**.
4. Com o código, ele entra em `/meus-processos` e vê os próprios casos, o
   histórico de andamentos e os próprios documentos.

Nada disso abre sem o gatilho do passo zero: **alguém do escritório precisa ter
registrado a assinatura do contrato.**

---

## O gatilho que faltava

O campo `contratoAssinadoEm` existia desde a Sprint 0 e era **lido em três
telas**, mas nenhuma tela escrevia nele. Na prática, nenhum cliente jamais
entraria — a porta existia, sem maçaneta.

Agora a ficha do cliente tem o cartão **"Acesso do cliente"**, onde o operador
informa a data que consta no documento assinado. Isso:

- grava `contratoAssinadoEm`;
- cria o usuário de perfil CLIENTE ligado àquele cadastro;
- entra na auditoria com autor identificado (regra 6).

E tem o inverso, **revogar**, que apaga a data, desativa o usuário e invalida
os códigos pendentes de uma vez só. Em LGPD, poder cortar um acesso é tão
obrigatório quanto poder concedê-lo.

**Cadastro sem e-mail não libera acesso.** O código só chega por e-mail; marcar
como "liberado" quem não pode receber o código seria mentira na tela. É a mesma
regra que o escritório pediu em 14/09: "melhor não deixar salvar, para não criar
futuras pendências".

Quando o **D4Sign** entrar (dependência 3.3, travada no token de API), é o
retorno da assinatura que vai chamar a mesma função. Até lá — e para o contrato
assinado em papel — quem informa é o operador.

---

## Uma coisa do protótipo não foi seguida

O protótipo, na tela "Cliente — entrar", escreve:

> Código enviado para **m•••••@email.com.br**

Isso não foi implementado, **de propósito**. Mostrar o e-mail, mesmo mascarado,
só é possível depois de encontrar o cliente — e portanto responde, a quem digitou
um CPF qualquer, se aquela pessoa é cliente deste escritório. A relação entre uma
pessoa e o advogado dela é exatamente o tipo de informação que este portal existe
para proteger.

Pelo mesmo motivo, **toda** resposta do pedido de código é idêntica:

| O que aconteceu de verdade | O que a tela diz |
|---|---|
| Documento não existe | o mesmo texto |
| Cliente existe, contrato não assinado | o mesmo texto |
| Cliente existe, sem e-mail no cadastro | o mesmo texto |
| Limite de pedidos estourado | o mesmo texto |
| SMTP do escritório fora do ar | o mesmo texto |
| Código enviado com sucesso | o mesmo texto |

O CLAUDE.md prevê este caso: quando o protótipo conflita com o escopo, o escopo
vence e se avisa. Está avisado aqui e no comentário de `src/app/consultar/page.tsx`.

**Falar disso na demonstração**, porque é uma diferença visível em relação ao que
o escritório aprovou.

---

## Os limites, e por que cada um existe

| Limite | Valor | Por quê |
|---|---|---|
| Validade do código | 10 minutos | o protótipo define |
| Tentativas por código | 5, depois ele morre | seis dígitos caem em poucas horas de chute |
| Espera entre pedidos | 60 segundos | o protótipo mostra "Reenviar em 0:38" |
| Pedidos por cliente | 3 a cada 15 minutos | ninguém enche a caixa de e-mail de um cliente |
| Pedidos por endereço | 10 a cada 15 minutos | ninguém usa o SMTP do escritório como arma, nem varre CPFs |

O código **não é guardado em texto**: vale o mesmo Argon2id das senhas. Quem
tivesse leitura do banco não entraria no lugar de nenhum cliente.

Pedir um código novo **invalida o anterior**. Dois códigos válidos ao mesmo tempo
dobrariam a chance de acerto de quem está chutando.

Todo pedido entra na auditoria — inclusive o de documento que não é de ninguém.
É esse registro que sustenta o limite por endereço e é ele que mostra, depois, se
alguém varreu CPFs contra o portal. **O documento tentado não é guardado quando
não é de cliente**: seria acumular CPF de terceiro em log, sem utilidade e contra
a LGPD.

---

## Por que a sessão do cliente é relida do banco

O cookie é assinado, mas o que está escrito nele é uma fotografia do momento da
entrada. Se o escritório revogar o acesso no minuto seguinte, a fotografia
continuaria dizendo "contrato assinado" por até oito horas.

Por isso `exigirSessaoDeCliente` relê as três condições do banco a **cada
requisição**: usuário ativo, vínculo com cliente, contrato assinado. Custa uma
consulta por página. Um cliente enxergando o que não devia custa muito mais.

O `contratoAssinado` gravado no token não decide nada sozinho — é conveniência
para o middleware, que é só a primeira barreira.

---

## O teste que não pode falhar

`testes-de-banco/isolamento-do-cliente.teste.ts`, contra o **Postgres de
verdade**, não contra um dublê. Dois clientes montados com caso, andamento e
documento próprios, e então:

- cada um lista só o próprio caso e os próprios documentos;
- o andamento de um não aparece na lista do outro;
- colar o id alheio na URL devolve nada — caso, ficha, andamentos e documento;
- o documento **próprio**, esse sim, sai por URL assinada (é o controle positivo:
  sem ele, os "não vê nada" poderiam estar passando por montagem quebrada);
- sem contrato assinado, a sessão não consulta nada;
- o código de um cliente não serve para o outro;
- o código serve uma vez só e morre na quinta tentativa errada;
- revogar corta o acesso na hora.

Roda com `npm run test:banco`, e no CI depois do `prisma migrate deploy`. Por que
fora do `npm run test`: a suíte unitária roda em segundos e sem infraestrutura, e
misturar as duas tornaria o retorno lento o suficiente para alguém querer pular.

---

## O que a implantação precisa

O envio do código depende do **SMTP do escritório**. Sem estas variáveis o
sistema **não manda e-mail nenhum**, e o cliente não entra:

```
SMTP_SERVIDOR=
SMTP_PORTA=587
SMTP_SEGURO=false     # true só para TLS implícito na porta 465
SMTP_USUARIO=
SMTP_SENHA=           # secreta no EasyPanel (regra 8)
EMAIL_REMETENTE="Portal do Cliente — E. Ferreira Advogados <portal@eferreira.adv.br>"
```

Em desenvolvimento, sem SMTP configurado, o e-mail que sairia é **impresso no
terminal** — inclusive o código. Em produção, a falta da configuração vira erro
no log do servidor, e a tela continua dizendo o mesmo de sempre.

---

## O que ainda falta

1. **Credenciais do SMTP** do escritório. Ele confirmou que tem o serviço; falta
   servidor, porta, usuário, senha e qual endereço vai como remetente.
2. **Subdomínio do portal** e o acesso ao DNS na Locaweb (dependência 3.3). O
   endereço que o cliente vai digitar sai daí.
3. **Token de API do D4Sign** (3.3), para que a assinatura eletrônica passe a
   preencher o gatilho sozinha.
4. **Logo em vetor** (3.2): a área do cliente usa o desenho do protótipo, como o
   resto do sistema.

---

## O e-mail é Gmail, e isso tem uma pegadinha (14/09/2026)

O escritório informou a conta: **`contato@eferreira.adv.br`**, em domínio
próprio — ou seja, Google Workspace. Servidor, porta, usuário e remetente já
estão preenchidos no `.env.example`.

**A senha da conta não funciona no SMTP.** O Google recusa autenticação com a
senha comum; é preciso:

1. ativar a **verificação em duas etapas** na conta;
2. gerar uma **senha de app** em `myaccount.google.com/apppasswords`;
3. usar essa senha de dezesseis caracteres em `SMTP_SENHA`.

Com a senha comum, a resposta é sempre `535-5.7.8 Username and Password not
accepted`, e nenhuma outra configuração resolve.

### Como conferir sem adivinhar

```
npm run email:teste
```

Manda o mesmo e-mail que o cliente recebe, com um código de mentira, usando o
mesmo transporte da aplicação. Se o servidor recusar, o script traduz o erro —
inclusive este caso do Google, que é o mais comum.

Existe porque a falha de e-mail é **silenciosa de propósito**: a tela de
entrada responde sempre a mesma coisa, exista o cadastro ou não, e o mesmo vale
se o SMTP estiver fora. É a resposta certa para quem está do outro lado, e
péssima para quem está configurando.

### Duas coisas a conferir depois do primeiro envio

- **Se cair no spam**, o domínio precisa de SPF e DKIM apontando para o Google.
  Código de acesso no spam é cliente que não entra.
- **O remetente precisa ser a própria conta** (ou um alias confirmado nela).
  O Gmail reescreve endereços de terceiros, e o cliente recebe um "em nome de"
  que faz qualquer pessoa desconfiar do código.
