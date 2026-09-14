# Modelos de documento do escritório — mapa de campos

Recebidos em **14/09/2026** (dependência 3.1 do Anexo II). Quatro arquivos
`.docx`: procuração, declaração de hipossuficiência, contrato de prestação de
serviços advocatícios e termo de acordo extrajudicial.

> **Os arquivos não estão no repositório, de propósito.** O escritório enviou
> documentos **reais preenchidos**, não modelos em branco: eles contêm nome
> completo, CPF, RG, nome da mãe e endereço residencial de clientes de verdade,
> além dos dados bancários do escritório. Versionar isso gravaria dado pessoal
> de terceiro no histórico do git para sempre, sem necessidade. Os `.docx` ficam
> em `docs/modelos/`, que está no `.gitignore`.
>
> **Pedir ao escritório versões em branco**, com os trechos variáveis marcados.
> É o que deve entrar no repositório.

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

## O que falta perguntar

1. **Modelos em branco**, com os trechos variáveis marcados, para substituir os
   documentos reais.
2. **Nome da mãe** entra como obrigatório? (os três documentos precisam dele)
3. **Honorários e parcelas**: confirmar que ficam no cadastro do caso, e que o
   escopo para nisso — sem controle de pagamento.
4. **Termo de acordo**: está dentro ou fora? A resposta sobre status disse que o
   polo passivo está fora, mas o modelo foi enviado.
5. O documento é **por caso** ou **por cliente**? O contrato cita um processo
   específico, o que sugere que contrato e procuração nascem de um caso.
