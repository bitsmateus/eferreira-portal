# Escopo contratual — transcrição dos Anexos I e II

> Transcrição fiel dos anexos do contrato assinado entre **E. Ferreira Advogados**
> (CONTRATANTE) e **NX Netscale Ltda** (CONTRATADA).
> Este documento é a fonte de verdade do escopo. Em qualquer conflito com o
> roadmap, o protótipo ou uma conversa, **o anexo vence**.

---

# ANEXO I — ESCOPO DETALHADO DO PROJETO
## Sistema de Cadastro de Clientes e Acompanhamento de Processos

Este anexo integra o contrato para todos os fins e define, de forma vinculante, as
funcionalidades a serem desenvolvidas e entregues pela CONTRATADA em **entrega
única, precedida de demonstração para validação**.

## 1. Infraestrutura, painel e perfis de acesso

**a)** hospedagem em servidor dedicado, na modalidade da Cláusula 5ª, com banco de
dados próprio, tráfego criptografado e rotina automática de backup;

**b)** credenciais exclusivas da CONTRATANTE, com acessos individuais por e-mail e
senha e perfis diferenciados de permissão;

**c)** **perfil operador (interno):** executa todos os passos do fluxo, cadastra
clientes e casos, anexa documentos e atualiza os andamentos;

**d)** **perfil cliente (externo):** acesso restrito às informações dos seus
próprios casos, mediante informação do CPF, **liberado após a assinatura do
contrato**;

**e)** organização de todos os registros por **CPF ou CNPJ**.

## 2. Fluxo operacional — os quatro passos

**1. Cadastro do cliente:** realizado pela equipe do escritório, com registro por
**CPF ou CNPJ** e dados de qualificação e contato, sendo o CPF ou CNPJ a chave de
identificação do cliente em todo o sistema;

**2. Reconhecimento no sistema:** a partir do cadastro, o sistema da CONTRATADA
reconhece o cliente e vincula a ele os casos correspondentes, em registro único,
com identificação de cada caso e do respectivo **número de processo**;

**3. Procuração e declaração:** registrada a assinatura do contrato pelo cliente,
o sistema gera, a partir dos modelos da CONTRATANTE, a **procuração** e a
**declaração**, disponibiliza-as para assinatura e as arquiva na pasta do cliente;

**4. Consulta do cliente:** o cliente acessa a área de consulta informando o seu
**CPF** e visualiza o **número do processo** e o respectivo **andamento**,
conforme as informações inseridas pela equipe do escritório, com data e histórico
das atualizações.

> **Nota de implementação (alinhada com o fornecedor):** os quatro passos operam
> com **CPF ou CNPJ**, não apenas CPF — inclusive na consulta do cliente, já que há
> clientes pessoa jurídica. O anexo cita "CPF" no passo 4 por simplificação de
> redação; a chave é a mesma do item 1.e.

## 3. Nova logo e nova API

**a)** aplicação da **nova logo** no painel administrativo, na área de consulta do
cliente e nos documentos gerados pelo sistema, com ajuste de cores, cabeçalhos e
rodapés conforme a identidade visual fornecida pronta pela CONTRATANTE;

**b)** **nova API** com credenciais próprias da CONTRATANTE, contemplando endpoints
de consulta por **CPF ou CNPJ**, com retorno do número do processo e do andamento,
e endpoints de cadastro e atualização de clientes, casos e andamentos;

**c)** controle de autenticação e de permissões de acesso à API, documentação
técnica e **ambiente de testes** para validação.

## 4. Entregas complementares e critério de aceite

**a)** **pasta única por cliente**, reunindo o contrato, a procuração, a declaração
e os documentos de cada caso, com histórico de andamentos e download pelo painel;

**b)** demonstração para validação, publicação em produção em domínio definido pela
CONTRATANTE, treinamento da equipe e entrega das credenciais de administração e da
documentação da API;

**c) aceite:** considera-se cumprido o objeto quando a CONTRATANTE conseguir
executar, **em produção e de ponta a ponta**, o cadastro do cliente por CPF ou
CNPJ, o reconhecimento dos seus casos, a geração e o arquivamento da procuração e
da declaração e a consulta, pelo cliente, do número do processo e do andamento,
com a nova logo aplicada e a nova API respondendo conforme a documentação.

---

# ANEXO II — FORA DO ESCOPO, FASES FUTURAS E DEPENDÊNCIAS

## 1. Fora do escopo deste contrato

**a)** criação, redesenho ou vetorização da logo e da identidade visual, que serão
fornecidas prontas pela CONTRATANTE;

**b)** migração dos cadastros e documentos históricos hoje mantidos em planilhas,
sistemas ou serviços de nuvem de terceiros;

**c)** integração com sistemas de terceiros não indicados pela CONTRATANTE no item
3 deste anexo, **inclusive sistemas de tribunais e captura automática de
movimentações**;

**d)** peticionamento, protocolo ou automação de atos processuais; aplicativo
nativo para iOS ou Android; módulo financeiro e controle de honorários;

**e)** manutenção continuada após o prazo de garantia e os custos de infraestrutura
e de serviços de terceiros da Cláusula 6ª.

## 2. Fases futuras

Frentes que a CONTRATANTE pretende avaliar na sequência, com escopo próprio a ser
detalhado e contratado separadamente: captura automática das movimentações junto
aos sistemas dos tribunais, com atualização automática do andamento; notificação
automática ao cliente a cada nova movimentação; gestão de prazos, tarefas e agenda
da equipe; módulo financeiro e de gestão de honorários; e painel de indicadores e
relatórios gerenciais.

## 3. Dependências sob responsabilidade da CONTRATANTE

A ausência ou o atraso na definição e no fornecimento dos itens abaixo **prorroga,
na mesma proporção, o prazo da Cláusula 3ª**:

1. modelos atuais de **contrato, procuração e declaração**, base para a geração
   dos documentos pelo sistema;
2. arquivos da **nova logo** e da identidade visual, em formato vetorial ou de alta
   resolução, com as cores institucionais;
3. definição do **domínio definitivo** e dos serviços que consumirão a nova API,
   com as respectivas credenciais e documentação, quando houver;
4. definição da **forma de coleta da assinatura** do contrato, da procuração e da
   declaração: upload do documento assinado, assinatura eletrônica em plataforma
   indicada pela CONTRATANTE ou aceite registrado no próprio sistema;
   → **RESOLVIDO: assinatura eletrônica em plataforma externa.**
5. definição dos **campos obrigatórios** do cadastro de cliente e de caso e da
   **lista de status de andamento** exibidos ao cliente;
6. definição das **regras de acesso do cliente** à área de consulta, isto é, se a
   autenticação será apenas por CPF ou por CPF acrescido de segundo fator, tal como
   senha ou código enviado por e-mail;
   → **RESOLVIDO: CPF ou CNPJ + código enviado por e-mail.**
7. informação da **quantidade de colaboradores** com acesso ao painel, para
   dimensionamento de usuários e permissões;
8. definição quanto à eventual **migração dos cadastros e documentos históricos**,
   item que não integra este contrato e que, se necessário, será orçado à parte.

---

## Pendências abertas — o que ainda falta do escritório

| # | Item | Trava |
|---|---|---|
| 3.1 | Modelos de contrato, procuração e declaração | Sprint 3 |
| 3.2 | Logo em vetor e cores institucionais | Sprint 5 e os documentos |
| 3.3 | Domínio definitivo e credenciais da plataforma de assinatura | Sprint 3 e a publicação |
| 3.5 | Campos obrigatórios e **lista de status de andamento** | Sprint 2 |
| 3.7 | Quantidade de colaboradores | Não bloqueia |
| 3.8 | Migração de histórico | Fora do contrato |

Se qualquer uma dessas faltar quando a sprint correspondente começar, **pare e
avise** — não invente modelo de documento nem lista de status.
