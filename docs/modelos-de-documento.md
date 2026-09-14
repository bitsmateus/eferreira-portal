# Modelos de documento do escritório — mapa de campos

Recebidos em **14/09/2026** (dependência 3.1 do Anexo II). Quatro arquivos
`.docx`: procuração, declaração de hipossuficiência, contrato de prestação de
serviços advocatícios e termo de acordo extrajudicial.

> **Os arquivos não estão no repositório.** O escritório enviou os modelos
> **preenchidos com dados fictícios**, para servirem de base — foi o que ele
> informou. Os quatro `.docx` ficam em `docs/modelos/`, no `.gitignore`, como
> referência de consulta.
>
> Eles não entram no versionamento porque não precisam: o que o sistema usa são
> os modelos **em branco**, em `src/modelos/`, com marcadores no lugar dos
> dados. Esses sim estão versionados. Manter os preenchidos fora evita a
> pergunta "isto é fictício mesmo?" toda vez que alguém abrir o repositório —
> os sete CPFs e CNPJs dos exemplos passam no dígito verificador, e o CNPJ com
> a chave PIX é a conta real do escritório.

Este arquivo é a transcrição **apenas da estrutura**: quais campos cada
documento consome, sem nenhum valor real.

---

## O bloco de qualificação

Procuração, declaração e contrato abrem com **o mesmo bloco**, na mesma ordem —
o que confirma o que o escritório respondeu: os dados do CONTRATANTE no contrato
servem de OUTORGANTE na procuração e de declarante na declaração.

```
NOME COMPLETO, nacionalidade, estado civil, nome da mãe: NOME DA MÃE,
portador(a) do RG número: NÚMERO ÓRGÃO-UF, inscrito(a) no CPF sob o número:
CPF, e-mail: E-MAIL, residente e domiciliado à ENDEREÇO, CEP: CEP.
```

| Campo do documento | Campo no sistema | Situação |
|---|---|---|
| Nome completo | `cliente.nome` | existe |
| Nacionalidade | `cliente.nacionalidade` | existe |
| Estado civil | `cliente.estadoCivil` | existe |
| **Nome da mãe** | — | **NÃO EXISTE** |
| RG + órgão emissor | `cliente.rg` | existe (texto livre; o órgão vai junto) |
| CPF | `cliente.documento` | existe |
| E-mail | `cliente.email` | existe |
| Endereço | `cliente.endereco` | existe |
| CEP | `cliente.cep` | existe |

**Nome da mãe é campo novo.** Aparece nos três documentos e ninguém o citou na
lista de campos obrigatórios. Sem ele, procuração, declaração e contrato saem
incompletos — exatamente o risco que a pergunta sobre campos obrigatórios
pretendia evitar.

**Data de nascimento não é usada por nenhum documento**, o que confirma a
resposta do escritório ("tiramos").

**Profissão também não aparece em nenhum dos três**, embora o escritório a tenha
marcado como obrigatória. Não é problema — exigir é decisão do escritório —, mas
vale saber que nenhum documento depende dela.

---

## Procuração

Além do bloco de qualificação:

| Trecho | Origem |
|---|---|
| Dados do outorgado (advogado, OAB, endereço profissional) | fixo do escritório |
| Cláusula de poderes (*ad judicia et extra*) | texto fixo, **não alterar** |
| Cidade e data por extenso | gerado (regra 11) |
| Linha de assinatura com o nome do outorgante | `cliente.nome` |

## Declaração de hipossuficiência

Bloco de qualificação + texto fixo da lei + cidade, data e assinatura. **Nenhum
campo variável além da qualificação.** É o documento mais simples de gerar.

## Contrato de prestação de serviços advocatícios

Consome o bloco de qualificação e **mais coisas que o sistema ainda não guarda**:

| Trecho | Campo no sistema | Situação |
|---|---|---|
| Objeto: tipo da ação | `caso.assunto` | existe |
| Objeto: contra quem | `caso.parteContraria` | existe |
| **Valor dos honorários** | — | **NÃO EXISTE** |
| **Forma de pagamento: nº de parcelas, valor e vencimento de cada uma** | — | **NÃO EXISTE** |
| Dados bancários e PIX do escritório | fixo do escritório | — |
| Telefone e e-mail de contato do escritório | fixo do escritório | — |
| Testemunhas (duas linhas em branco) | preenchido à mão | — |

> **Atenção à regra 12.** Guardar o valor dos honorários e as parcelas **como
> campos do contrato** é necessário para gerar o documento. Isso **não** é o
> "módulo financeiro" que o Anexo II coloca fora do escopo — não há controle de
> recebimento, baixa de parcela, inadimplência nem relatório financeiro. A
> fronteira precisa ser dita em voz alta antes de implementar.

## Termo de acordo extrajudicial de confissão de dívida

**Este documento é do fluxo de acordo — o "polo passivo", que o escritório
disse estar fora do escopo.** Ainda assim o arquivo foi enviado como um dos que
"vamos usar". Contradição a resolver antes de qualquer implementação.

Estrutura, para registro: credor e devedor, **ambos podendo ser pessoa jurídica
representada por sócio ou presidente**, cada um com qualificação própria; valor
da dívida por extenso; número de parcelas, valor e vencimento; dados bancários
do escritório.

Ele confirma, de forma independente, a necessidade do **representante legal**:
uma empresa aparece sempre "neste ato representada por seu sócio/presidente",
com nome, RG, CPF, endereço e e-mail próprios — que é o "mesmo cadastro da PF
ligado ao cadastro do PJ" descrito pelo escritório.

---

## Respondido pelo escritório em 14/09/2026

1. **Usar os modelos enviados**, tirando os dados. Feito.
2. **Nome da mãe é obrigatório.** Feito — bloqueia a gravação da pessoa física.
3. **Honorários e parcelas** ficam no cadastro do caso, "nada vinculado
   referente a pagamentos, somente a adicionar". Feito, com a fronteira da
   regra 12 escrita no próprio schema.
4. **Termo de acordo extrajudicial: fora do escopo.** Não foi implementado.

## O que ainda falta perguntar

1. **A numeração repetida da cláusula 9ª** no contrato. Precisa de correção do
   escritório; o sistema não reescreve texto jurídico.
2. **Qual dos dois endereços profissionais é o correto** (ver
   `src/lib/escritorio.ts`).
3. O documento é **por caso** ou **por cliente**? Hoje o contrato exige um caso
   — porque cita o objeto da ação e os honorários — e procuração e declaração
   são do cliente. Confirmar se é assim que o escritório trabalha.
4. **Logo em vetor** (dependência 3.2). Enquanto não chega, o cabeçalho e o
   rodapé dos documentos saem com o nome em texto.
5. **Token de API do D4Sign**, para o envio à assinatura.

---

## Como os modelos viraram sistema (14/09/2026)

Os três modelos em uso estão em `src/modelos/`, como HTML com marcadores
`{{campo}}`, mais um `estilo.css` compartilhado. O termo de acordo ficou fora,
por decisão do escritório.

O mesmo HTML e o mesmo CSS servem à prévia na tela e ao PDF — a prévia é
montada pela **mesma função** que a geração usa (`montarPrevia`), justamente
para que não exista um caminho que possa divergir do outro.

**Defeito do original, preservado:** o contrato tem duas cláusulas numeradas
como **9ª** ("Autorização para recebimento" e "Foro"). Corrigir seria
reescrever texto jurídico por conta própria, o que a regra 10 proíbe. Precisa
voltar ao escritório.

**Divergência do original, resolvida por ora:** os modelos trazem dois
endereços profissionais diferentes (Av. Paulista/São Paulo na procuração, Rua
Olegário Paiva/Mogi das Cruzes no contrato). Adotei o do contrato, que é mais
completo e coerente com o foro citado. Está marcado em `src/lib/escritorio.ts`.

**Pessoa jurídica:** o documento sai com nome e CNPJ da empresa, mas a
qualificação pessoal (nacionalidade, estado civil, nome da mãe, RG) vem do
**representante legal** vinculado. Empresa sem sócio vinculado não gera
documento, e a tela diz isso.

### O que a implantação precisa

O PDF é gerado com Playwright (Chromium). Além do `npm ci`, o servidor precisa
do navegador:

```
npx playwright install --with-deps chromium
```

Sem isso, a geração falha em tempo de execução — o build passa normalmente,
porque o navegador só é necessário na hora de gerar.
