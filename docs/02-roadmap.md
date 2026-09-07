# Mapa de Desenvolvimento (Sprints)

## Portal do Cliente — E. Ferreira Advogados
### Sistema de Cadastro de Clientes e Acompanhamento de Processos

**Cliente:** E. Ferreira Advogados · **Fornecedor:** NX Netscale Ltda
**Base:** Anexo I (escopo detalhado) e Anexo II (fora do escopo e dependências) do contrato assinado
**Versão:** 1.0 — 31/08/2026

---

## 1. O que está sendo construído

Um sistema onde a equipe do escritório cadastra cliente e caso, gera os documentos a
partir dos modelos do escritório, coleta a assinatura e registra os andamentos — e onde
o cliente entra com o próprio CPF e vê em que pé está o processo dele, sem telefonar.

O contrato define entrega **única**, precedida de demonstração para validação. Isso não
significa desenvolver seis semanas às escuras: significa que existe **uma** entrega
contratual formal. Internamente o trabalho corre em seis sprints, e ao final de cada uma
existe algo que se abre no navegador de homologação. Você acompanha; o Dr. Sergio só é
convocado nos dois marcos de demonstração.

### Decisões já tomadas

| Tema | Decisão |
|---|---|
| Identidade | Tema claro, grafite e prata nos acentos — a marca aparece no topo, nos documentos e na área do cliente |
| Assinatura | Plataforma de assinatura eletrônica externa (Anexo II, item 3.4 — **resolvido**) |
| Acesso do cliente | CPF + código enviado por e-mail (Anexo II, item 3.6 — **resolvido**) |
| Nome | "Portal do Cliente — E. Ferreira" na área externa; painel interno sem nome próprio |
| Chave de identificação | CPF ou CNPJ, em todo o sistema (Anexo I, 1.e e 2.1) |

---

## 2. As sprints

### Sprint 0 — Fundação
**Entrega:** o esqueleto de pé, com login funcionando e deploy em homologação.

- Projeto Next.js 15 + TypeScript, Prisma, PostgreSQL
- Modelo de dados completo: pessoa (CPF/CNPJ), caso, andamento, documento, usuário, auditoria
- Autenticação por e-mail e senha, com Argon2id
- Perfis **operador** (interno) e **cliente** (externo), com autorização no servidor
- Serviço no EasyPanel: projetos `producao` e `homologacao` separados
- Backup automático do banco, com **teste de restauração feito antes de existir dado real**
- CI no GitHub rodando testes a cada PR

**Pronto quando:** o link de homologação abre, o login entra, e o restore do backup foi
executado com sucesso uma vez.

---

### Sprint 1 — Clientes e casos
*Cobre o Anexo I, itens 2.1 e 2.2*

- Cadastro de cliente com **validação real de CPF e CNPJ** (dígito verificador, não só máscara)
- Dados de qualificação e contato
- Busca por CPF, CNPJ ou nome
- Cadastro de caso vinculado ao cliente, com **número do processo**
- Um cliente com vários casos; cada caso com identificação própria
- Reconhecimento automático: ao digitar um CPF já cadastrado, o sistema traz o cliente e
  os casos dele em vez de duplicar o registro

**Pronto quando:** cadastrar um cliente, vincular dois casos e reencontrá-los pelo CPF
funciona ponta a ponta, com teste automatizado cobrindo o CPF inválido.

---

### Sprint 2 — Andamentos e a pasta única
*Cobre o Anexo I, itens 2.4 e 4.a*

- Registro de andamento com **data e histórico**, na linha do tempo do caso
- Lista de status configurável — a definir com o escritório (Anexo II, item 3.5)
- **Pasta única por cliente**, reunindo contrato, procuração, declaração e documentos de
  cada caso
- Upload, visualização e download pelo painel
- Registro de auditoria: quem inseriu o quê e quando

**Pronto quando:** um caso mostra a linha do tempo completa e a pasta do cliente lista
todos os arquivos dos casos dele em um lugar só.

---

### Sprint 3 — Documentos e assinatura
*Cobre o Anexo I, item 2.3*

- Geração de **procuração** e **declaração** a partir dos modelos do escritório, com os
  dados do cliente preenchidos
- Registro da assinatura do contrato como gatilho: só depois dela o sistema gera os
  documentos e libera o acesso do cliente (Anexo I, 1.d)
- Envio para a plataforma de assinatura eletrônica
- Retorno do documento assinado direto para a pasta do cliente
- Documentos com a nova logo no cabeçalho e no rodapé

**Pronto quando:** um documento sai do sistema, é assinado na plataforma e volta
arquivado na pasta certa, sem ninguém mover arquivo à mão.

> **Depende de:** modelos atuais de contrato, procuração e declaração (Anexo II, 3.1) e
> credenciais da plataforma de assinatura (Anexo II, 3.3). Sem os dois, esta sprint para.

---

### Sprint 4 — Área do cliente
*Cobre o Anexo I, itens 1.d e 2.4*

- Login por **CPF + código enviado por e-mail**
- Lista dos casos do próprio cliente, e só deles
- Número do processo, status atual e histórico de andamentos com data
- Download dos documentos do próprio caso
- Acesso liberado **apenas após a assinatura do contrato** — antes disso, o cliente não
  entra

**Pronto quando:** dois clientes diferentes entram e nenhum enxerga nada do outro,
comprovado por teste automatizado. Este é o teste que não pode falhar.

---

### Sprint 5 — Nova logo e nova API
*Cobre o Anexo I, item 3*

- Aplicação da identidade visual em todo o painel, na área do cliente e nos documentos
  gerados — cores, cabeçalhos e rodapés
- **API com credenciais próprias do escritório:**
  - consulta por CPF ou CNPJ, com retorno do número do processo e do andamento
  - cadastro e atualização de clientes, casos e andamentos
- Autenticação e permissões de acesso à API
- Documentação técnica dos endpoints
- Ambiente de testes para validação

**Pronto quando:** um terceiro consegue consultar um andamento pela API usando só a
documentação, sem perguntar nada a você.

---

### Sprint 6 — Demonstração, aceite e produção

- Demonstração ao Dr. Sergio para validação (exigência do Anexo I, 4.b)
- Ajustes apontados na demonstração
- Publicação em produção no domínio definido pelo escritório
- Treinamento da equipe
- Entrega das credenciais de administração e da documentação da API

---

## 3. O critério de aceite, traduzido em checklist

O item 4.c do Anexo I define o aceite. Ele é um roteiro único, executado **em produção**,
de ponta a ponta. Vale tratar como checklist literal:

- [ ] cadastrar um cliente por CPF **ou** CNPJ
- [ ] o sistema reconhecer os casos desse cliente
- [ ] gerar a procuração e a declaração
- [ ] arquivar as duas na pasta do cliente
- [ ] o cliente consultar, sozinho, o número do processo e o andamento
- [ ] a nova logo aplicada
- [ ] a nova API respondendo conforme a documentação

Cumpridos os sete, o objeto está cumprido. Nem mais, nem menos — e vale executar esse
roteiro na frente do cliente, na demonstração, para que o aceite não vire discussão.

---

## 4. O que trava se atrasar

O Anexo II, item 3, lista oito dependências do escritório e diz que o atraso nelas
**prorroga o prazo na mesma proporção**. Na prática, quatro delas são caminho crítico:

| # | Dependência | Trava | Quando precisa chegar |
|---|---|---|---|
| 3.1 | Modelos de contrato, procuração e declaração | Sprint 3 inteira | Antes do fim da Sprint 2 |
| 3.2 | Logo e identidade em vetor ou alta resolução, com as cores institucionais | Sprint 5 e os documentos | Antes do fim da Sprint 4 |
| 3.3 | Domínio definitivo e credenciais da plataforma de assinatura | Sprint 3 e a publicação | Antes do fim da Sprint 2 |
| 3.5 | Campos obrigatórios do cadastro e **lista de status de andamento** | Sprint 2 | Antes do início da Sprint 2 |

As demais (3.4 e 3.6 já resolvidas, 3.7 quantidade de colaboradores, 3.8 migração de
histórico) não bloqueiam o desenvolvimento.

Sugestão prática: mandar essas quatro pendências ao Dr. Sergio **hoje**, em uma mensagem
só, com a data em que cada uma trava. Cobrança feita depois do atraso não recupera prazo;
cobrança feita antes, sim.

---

## 5. O que está fora — e é bom repetir

O Anexo II, item 1, exclui explicitamente. Vale reler antes de aceitar qualquer pedido
"rapidinho" no meio do caminho:

- criação, redesenho ou vetorização da logo — vem pronta do escritório
- migração dos cadastros e documentos históricos hoje em planilhas ou Dropbox
- integração com sistemas de terceiros não indicados, **inclusive tribunais e captura
  automática de movimentações**
- peticionamento, automação de atos processuais, aplicativo nativo iOS/Android, módulo
  financeiro e controle de honorários
- manutenção continuada após a garantia, e os custos de infraestrutura e de terceiros

As fases futuras (item 2 do Anexo II) — captura automática nos tribunais, notificação
automática ao cliente a cada movimentação, gestão de prazos e agenda, módulo financeiro,
painel de indicadores — são escopo próprio, orçado à parte. Não entram por conversa de
WhatsApp.

---

## 6. Riscos que eu já enxergo

**A captura automática de movimentações vai ser pedida.** É a primeira coisa que um
escritório quer quando vê um painel de andamentos, e está expressamente fora. Quando
surgir, a resposta é "está na fase 2, orçamos à parte" — e é melhor dizer isso na
demonstração, antes de virar expectativa.

**A lista de status de andamento é mais difícil do que parece.** Todo escritório acha que
tem cinco status e na prática usa vinte. Se essa lista chegar incompleta, a Sprint 2
entrega uma tela que o escritório não consegue usar. Vale sentar quinze minutos com quem
de fato lança andamento hoje, não só com o Dr. Sergio.

**A assinatura eletrônica tem custo por envio.** A decisão de usar plataforma externa é
boa juridicamente, mas cada procuração enviada custa. Isso é custo de terceiro da
Cláusula 6ª e precisa estar claro para o escritório antes do primeiro envio, não na
primeira fatura.

**Acesso do cliente é o ponto de maior risco do projeto.** São dados de processo de
terceiros. Um cliente ver o caso de outro não é bug de interface, é incidente de LGPD com
o titular sendo cliente de advogado. Por isso o isolamento tem teste automatizado próprio
e é o único critério de pronto que eu não flexibilizo.

---

## 7. Próximo passo

1. Validar este mapa e o protótipo com o Dr. Sergio
2. Enviar as quatro dependências de caminho crítico, com prazo
3. Abrir o repositório e rodar a Sprint 0
