# API do escritório — E. Ferreira Advogados

Versão **1** · Anexo I, itens 3.b e 3.c do contrato.

Esta é a documentação que se manda para quem vai integrar. Ela é
autossuficiente de propósito: o critério de pronto da Sprint 5 é *"um terceiro
consegue consultar um andamento pela API usando só a documentação, sem
perguntar nada"*.

---

## 1. Endereço e ambientes

Existem duas instalações, e elas não se misturam:

| Ambiente | Para que serve | Prefixo das chaves |
|---|---|---|
| **Homologação** | integrar, testar, errar à vontade | `ef_test_` |
| **Produção** | dados reais de cliente | `ef_live_` |

O endereço de cada uma é informado pelo escritório junto com a chave. Uma chave
de um ambiente **não funciona** no outro: a resposta é `401`, igual a chave
inexistente.

> **Comece sempre por homologação.** Os dados de produção são processos de
> pessoas reais.

---

## 2. Autenticação

Toda requisição leva a chave no cabeçalho:

```
Authorization: Bearer ef_test_a1b2c3d4e5f60718_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

A chave tem três partes: o prefixo do ambiente, um identificador público de 16
caracteres e o segredo. Guarde-a inteira, exatamente como veio — o segredo pode
ter `-` e `_` dentro.

**A chave aparece uma vez só**, na tela em que é gerada. O escritório não
consegue recuperá-la depois — no banco existe só um hash. Se perder, peça outra
e mande revogar a antiga.

Cada chave tem permissões próprias:

| Permissão | O que libera |
|---|---|
| `CONSULTAR` | ler cliente, casos e andamentos |
| `ESCREVER` | criar e alterar clientes, casos e andamentos |

Chave sem a permissão exigida pela rota recebe `403`.

### Conferir se a chave chegou certa

```bash
curl -s https://HOMOLOGACAO/api/v1/credencial \
  -H "Authorization: Bearer $CHAVE"
```

```json
{
  "nome": "Site institucional",
  "permissoes": ["CONSULTAR"],
  "ambiente": "testes",
  "versao": "1"
}
```

Este é o primeiro endpoint a chamar. Se ele responder, a chave está válida, no
ambiente que o `ambiente` diz.

---

## 3. Convenções

**Datas.** `data` e `contratoAssinadoEm` são dias civis no fuso
`America/Sao_Paulo`, escritos como `AAAA-MM-DD`. Não têm hora, e não devem ser
convertidos como se tivessem.

**CPF e CNPJ.** Aceitos com ou sem máscara. São validados pelo **dígito
verificador**, não só pelo formato: `111.111.111-11` é recusado. Nas respostas
vêm em dois campos — `documento` só com dígitos, `documentoFormatado` para
exibir.

**Corpo.** `application/json` nas requisições com corpo.

**Cache.** Nenhuma resposta pode ser guardada em cache. São dados de processo.

**Erros.** Sempre com esta forma:

```json
{
  "erro": "dados_invalidos",
  "mensagem": "Há campos inválidos ou faltando.",
  "campos": { "documento": "CPF ou CNPJ inválido." }
}
```

Programe contra o `erro`; a `mensagem` é para o log.

| `erro` | HTTP | Quando |
|---|---|---|
| `nao_autenticado` | 401 | chave ausente, inválida, de outro ambiente ou revogada |
| `sem_permissao` | 403 | a chave não tem a permissão da rota |
| `corpo_invalido` | 400 | o corpo não é um objeto JSON |
| `dados_invalidos` | 422 | algum campo reprovou na validação (ver `campos`) |
| `nao_encontrado` | 404 | o cliente, o caso ou a rota não existem |
| `conflito` | 409 | já existe registro com aquele CPF/CNPJ ou número de processo |

As regras de validação são **as mesmas do painel**. Se a tela recusa um
cadastro, a API recusa também — e com a mesma mensagem.

---

## 4. Consultar andamento por CPF ou CNPJ

```
GET /api/v1/consulta?documento=<CPF ou CNPJ>
```

Permissão: `CONSULTAR`.

| Parâmetro | Obrigatório | O que faz |
|---|---|---|
| `documento` | sim | CPF ou CNPJ, com ou sem máscara |
| `historico` | não | `true` acrescenta `historico` com a linha do tempo inteira |

```bash
curl -s "https://HOMOLOGACAO/api/v1/consulta?documento=529.982.247-25" \
  -H "Authorization: Bearer $CHAVE"
```

```json
{
  "cliente": {
    "id": "clx9a…",
    "nome": "Nome do cliente",
    "documento": "52998224725",
    "documentoFormatado": "529.982.247-25",
    "tipoPessoa": "FISICA",
    "contratoAssinadoEm": "2026-02-12"
  },
  "casos": [
    {
      "id": "clxb2…",
      "processo": "0012845-63.2026.8.26.0100",
      "assunto": "Ação de cobrança",
      "vara": "3ª Vara Cível — Foro Central/SP",
      "situacao": "EM_ANDAMENTO",
      "situacaoRotulo": "Em andamento",
      "andamento": {
        "data": "2026-08-31",
        "status": "Juntada de petição",
        "descricao": "Petição de réplica juntada aos autos."
      }
    }
  ]
}
```

- `processo` é `null` no caso ainda sem número (fase pré-processual).
- `andamento` é `null` no caso que ainda não teve nenhum.
- `situacao` é o valor estável (`EM_ANDAMENTO` ou `ARQUIVADO`); programe contra
  ele, e use `situacaoRotulo` só para exibir.
- `contratoAssinadoEm` é `null` enquanto o contrato não foi assinado.

Cada caso traz `empresa` (`{ id, nome, documento }`) quando está ligado a uma
empresa, ou `null`.

Documento válido sem cliente cadastrado devolve `404`; documento que reprova no
dígito verificador devolve `422`. São coisas diferentes de propósito: a primeira
é resposta, a segunda é erro de quem chamou.

### Casos ligados a uma empresa

```
GET /api/v1/consulta/empresa?documento=<CNPJ>
```

Permissão: `CONSULTAR`. Devolve os casos de OUTROS clientes que estão ligados à
empresa (ex.: os clientes que a GWA envia ao escritório) — a consulta por
`documento`, acima, devolve os casos do próprio cliente. `historico=true`
acrescenta a linha do tempo. A ligação é feita no cadastro do caso
(`empresaVinculadaId`).

```json
{
  "empresa": { "id": "clxe1…", "nome": "GWA Consultoria", "documento": "11222333000181", "documentoFormatado": "11.222.333/0001-81" },
  "casos": [
    {
      "id": "clxb2…",
      "processo": "0012845-63.2026.8.26.0100",
      "assunto": "Ação de cobrança",
      "vara": null,
      "situacao": "EM_ANDAMENTO",
      "situacaoRotulo": "Em andamento",
      "andamento": null,
      "cliente": { "id": "clx9a…", "nome": "Nome do cliente", "documento": "52998224725", "documentoFormatado": "529.982.247-25" }
    }
  ]
}
```

`404` sem empresa (pessoa jurídica) com aquele CNPJ; `422` para CNPJ inválido.

---

## 5. Lista de situações de andamento

```
GET /api/v1/status
```

Permissão: `CONSULTAR`.

```json
{
  "status": [
    { "id": "distribuido", "nome": "Distribuído", "ordem": 1 }
  ]
}
```

A lista é do escritório e pode mudar sem nova versão do sistema. **Consulte-a em
vez de fixar identificadores no seu código.**

---

## 6. Cadastrar cliente

```
POST /api/v1/clientes
```

Permissão: `ESCREVER`.

| Campo | Obrigatório | Observação |
|---|---|---|
| `documento` | sim | CPF (11 dígitos) ou CNPJ (14). Define o tipo de pessoa |
| `nome` | sim | nome completo ou razão social |
| `email` | pessoa física | é por ele que o cliente recebe o código de acesso ao portal (sem e-mail o acesso não é liberado) |
| `telefone` | pessoa física | |
| `endereco` | sim | logradouro, número, complemento e bairro — **sem a cidade** |
| `cidade` | sim | é dela que sai a cidade da assinatura dos documentos |
| `uf` | sim | sigla de dois caracteres, como `SP` |
| `cep` | sim | |
| `rg` | pessoa física | RG com órgão emissor |
| `estadoCivil` | pessoa física | |
| `profissao` | pessoa física | |
| `nacionalidade` | pessoa física | |
| `nomeMae` | não | nenhum documento pede mais |
| `dataNascimento` | não | `AAAA-MM-DD` |

Desde 24/09/2026 a lista é a do cabeçalho das procurações do escritório: para
pessoa jurídica só endereço, cidade, UF e CEP. A lista é a que o escritório definiu, e ela **bloqueia a
gravação** — foi pedido assim, "para não criar futuras pendências". Os campos de
pessoa física não se aplicam a CNPJ; a qualificação pessoal da empresa vem do
representante legal, cadastrado pelo painel.

```bash
curl -s -X POST https://HOMOLOGACAO/api/v1/clientes \
  -H "Authorization: Bearer $CHAVE" \
  -H "Content-Type: application/json" \
  -d '{
    "documento": "529.982.247-25",
    "nome": "Nome do cliente",
    "email": "cliente@exemplo.com.br",
    "telefone": "11 98888-7777",
    "endereco": "Rua Exemplo, 100, Centro",
    "cidade": "São Paulo",
    "uf": "SP",
    "cep": "01310-100",
    "rg": "12.345.678-9 SSP-SP",
    "estadoCivil": "solteiro",
    "profissao": "comerciante",
    "nacionalidade": "brasileiro",
    "nomeMae": "Nome da mãe"
  }'
```

`201` com `{ "clienteId": "clx…" }`.

**Documento já cadastrado não vira segundo registro.** A resposta é `409`:

```json
{
  "erro": "conflito",
  "mensagem": "Este CPF ou CNPJ já está cadastrado. Atualize o cliente existente em vez de criar outro.",
  "clienteId": "clx…",
  "nome": "Nome do cliente"
}
```

Use o `clienteId` que veio: é o mesmo reconhecimento que o painel faz quando o
operador digita um CPF conhecido.

---

## 7. Atualizar cliente

```
PUT /api/v1/clientes/{clienteId}
```

Permissão: `ESCREVER`.

**Substituição completa, não remendo.** O corpo descreve o cadastro inteiro,
igual ao do `POST`. Campo que você não mandar é tratado como vazio — e
obrigatório vazio é recusado com `422`. Se quiser alterar só um campo, consulte
antes e reenvie o resto.

`200` com `{ "clienteId": "clx…" }`.

---

## 8. Cadastrar caso

```
POST /api/v1/casos
```

Permissão: `ESCREVER`.

O cliente vai por `clienteId` **ou** por `documento` — o que você tiver em mãos.

| Campo | Obrigatório | Observação |
|---|---|---|
| `clienteId` ou `documento` | sim | um dos dois |
| `assunto` | sim | ao menos 3 caracteres |
| `numeroProcesso` | não | único no sistema; pode ficar vazio na fase pré-processual |
| `vara` | não | |
| `parteContraria` | não | |
| `situacao` | não | `EM_ANDAMENTO` (padrão) ou `ARQUIVADO` |
| `responsavelId` | não | id de um operador ou administrador ativo |
| `empresaVinculadaId` | não | id de um cliente PESSOA JURÍDICA a que o caso fica ligado (ex.: a empresa que enviou o cliente) |

```bash
curl -s -X POST https://HOMOLOGACAO/api/v1/casos \
  -H "Authorization: Bearer $CHAVE" \
  -H "Content-Type: application/json" \
  -d '{
    "documento": "529.982.247-25",
    "assunto": "Ação de cobrança",
    "numeroProcesso": "0012845-63.2026.8.26.0100",
    "vara": "3ª Vara Cível — Foro Central/SP"
  }'
```

`201` com `{ "casoId": "clx…", "clienteId": "clx…" }`.

Número de processo repetido devolve `409` com o `casoId` de quem já o tem.

> **Honorários e parcelas não entram por aqui.** São a cláusula de pagamento do
> contrato, digitada no painel junto com o documento que vai ser assinado.

---

## 9. Lançar andamento

```
POST /api/v1/casos/{casoId}/andamentos
```

Permissão: `ESCREVER`.

| Campo | Obrigatório | Observação |
|---|---|---|
| `data` | sim | `AAAA-MM-DD`. **Não pode estar no futuro** |
| `statusId` | sim | um `id` de `GET /api/v1/status` |
| `descricao` | sim | mínimo 10 caracteres |

```bash
curl -s -X POST https://HOMOLOGACAO/api/v1/casos/clxb2…/andamentos \
  -H "Authorization: Bearer $CHAVE" \
  -H "Content-Type: application/json" \
  -d '{
    "data": "2026-08-31",
    "statusId": "juntada",
    "descricao": "Petição de réplica juntada aos autos. Aguardando decisão."
  }'
```

`201` com `{ "andamentoId": "clx…", "casoId": "clx…" }`.

Duas coisas para escrever com cuidado:

1. **A `descricao` é o texto que o cliente lê** na área de consulta dele,
   palavra por palavra. Escreva pensando em quem não é advogado.
2. **Data futura é recusada.** Andamento registra o que já aconteceu;
   previsão na linha do tempo do cliente vira promessa.

O andamento nasce com autor identificado — aparece como `API · <nome da sua
chave>`. É por isso que cada integração tem chave própria.

---

## 10. O que a API **não** faz

Está fora do contrato (Anexo II, item 1), e não é esquecimento:

- **captura automática de movimentações em tribunais.** Este endpoint é
  lançamento manual, feito por quem chama. Ligá-lo a um robô de tribunal é a
  fase 2, orçada à parte;
- **download de documentos.** A pasta do cliente sai pelo painel e pela área do
  cliente, com URL assinada de validade curta;
- **peticionamento e automação de atos processuais**;
- **módulo financeiro e controle de honorários**;
- **acesso à área do cliente.** O cliente entra com CPF ou CNPJ e código por
  e-mail, não por chave de API.

---

## 11. Boas maneiras

- **Uma chave por serviço.** Assim dá para revogar um sem derrubar os outros.
- **Peça só a permissão que você usa.** Chave que só consulta não estraga
  cadastro por engano.
- **Guarde a chave fora do código** — variável de ambiente, cofre, o que for. E
  nunca em repositório.
- **Avise o escritório se ela vazar.** Revogar leva um clique e vale na hora.
