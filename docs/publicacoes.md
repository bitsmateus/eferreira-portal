# Publicações do DJEN — esteira de acompanhamento

Frente contratada à parte do Portal (escopo "Esteira de automação jurídica com
IA", enviado em 04/11/2026 e aprovado pelo escritório em 05/11/2026). O Anexo II
do contrato original deixava de fora a captura automática de movimentações e a
listava como fase futura; isto é essa fase futura.

## Como funciona

1. **Consulta.** Todo dia útil de manhã, a rotina consulta o DJEN (Diário de
   Justiça Eletrônico Nacional, do CNJ — `comunicaapi.pje.jus.br`) pelas OABs
   dos **advogados ativos** do cadastro (`/painel/advogados`). A janela é dos
   últimos 5 dias e se sobrepõe à rodada anterior de propósito; o `id` da
   comunicação no DJEN impede duplicar.
2. **Ligação ao caso.** Pelo número do processo. O que não bate com nenhum caso
   vai para a aba **Sem caso**, onde alguém liga ao caso certo ou descarta.
3. **Análise da IA** (quando configurada). Tipo do ato, resumo, providência,
   prazo em dias e um texto curto para o cliente. A **data** do prazo não é da
   IA: é calculada pelo portal (`src/lib/prazos.ts`).
4. **Aviso.** O responsável pelo caso recebe um e-mail com as publicações novas.
5. **Conferência** (`/painel/publicacoes`). A equipe confirma o prazo e, se
   quiser, cria a tarefa (evento do caso, que vai para a Google Agenda) e lança
   o andamento que o cliente lê. **Nada chega ao cliente sem este passo.**

## Prazo sugerido

Publicação = primeiro dia útil depois da disponibilização; o prazo começa no
primeiro dia útil depois da publicação (Lei 11.419/2006, art. 4º). Dia útil =
segunda a sexta, fora dos feriados nacionais, de Carnaval, Sexta-feira Santa,
Corpus Christi e do recesso de 20/12 a 20/01 (CPC, art. 220).

**Não entram:** feriado municipal ou estadual e suspensão de expediente do
tribunal. Por isso é sempre "sugerido" e a tela pede para conferir.

## Configuração

| Variável | Para quê |
|---|---|
| `PUBLICACOES_ROTINA_SEGREDO` | Segredo da rota da rotina. Vazio = a rota não existe |
| `IA_PROVEDOR` | `anthropic` (padrão) ou `openai` |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | Chave da conta de desenvolvedor do escritório |
| `IA_MODELO` | Opcional na Anthropic, obrigatório na OpenAI |

### O agendamento

Um agendador (o n8n do escritório, ou o cron do EasyPanel) chama, nos dias
úteis às 7h:

```
POST https://portal.eferreira.adv.br/api/rotinas/publicacoes
x-chave: <PUBLICACOES_ROTINA_SEGREDO>
```

Para buscar mais dias de uma vez (primeira carga): `?dias=30` (até 60). A
resposta traz só contagens. A análise da IA roda depois da resposta.

Sem agendador, o botão **Consultar agora** da tela faz a mesma rodada.

### Armadilha registrada

O DJEN limita a **20 requisições por minuto**. Por isso a consulta é por OAB
(uma ou duas páginas por advogado), e não processo a processo.

## Minuta por área (16/11/2026)

O escritório mandou oito agentes, um por área (pasta "Agentes" do Dropbox):
Trabalhista, Consumidor, Saúde/PcD, Bancário, Trânsito, Execuções, Cível e
empresarial, Família. Cada um virou uma pasta em `src/agentes/`:

- `instrucoes.txt` — o agente, sem mudar uma palavra (regra 10). Os oito têm
  o mesmo núcleo; a área começa em "ESCOPO ESPECIALIZADO".
- `modelo.txt` — a petição de exemplo da área, **sem dados pessoais**: nomes,
  CPF, RG, endereços, e-mails, CTPS, Renavam, números de contrato e o médico
  viraram marcadores entre colchetes. Decisão do escritório: "faça você
  mesmo". O original com os dados reais não entra no repositório. Há teste
  (`testes/minuta.teste.ts`) que recusa CPF, RG, e-mail e CNPJ nesses arquivos.

Como funciona:

1. O caso ganhou o campo **Área** (opcional, formulário do caso).
2. A **análise** da publicação leva junto a parte especializada do agente da
   área do caso, quando há área.
3. Na fila, cada publicação tem **Gerar minuta**: escolhe-se a área (vem a do
   caso) e a IA redige a peça com o agente inteiro, a petição de referência e
   **pesquisa de jurisprudência na web** (busca e leitura de páginas, só na
   Anthropic). Leva minutos; a tela se atualiza sozinha. Só gera quando alguém
   clica — decisão do escritório, por custo.
4. A minuta aparece em roxo, com a **nota de revisão** separada e a lista das
   **fontes que a pesquisa encontrou**. É rascunho: o portal não protocola nem
   manda nada a ninguém.
5. **Baixar em Word** (16/11/2026): `/painel/publicacoes/<id>/minuta` monta o
   `.docx` na hora (`src/lib/minuta-em-word.ts`, biblioteca `docx`), com o
   papel timbrado da página inteira atrás do texto, como no Word do
   escritório, e as margens e a fonte dos PDFs. Só a peça; a nota de revisão
   fica na tela. Não é gravado; o acesso vai para a auditoria.

Vai à IA: o agente, a petição sem dados pessoais, o inteiro teor (público, do
DJEN) e do caso só assunto, número, vara, parte contrária e o nome do cliente.
Nada de CPF, RG, endereço ou contato.

Custo: cada minuta é uma chamada longa mais até 8 buscas e 6 leituras de
página. Com a OpenAI não há pesquisa: a nota sai com a pesquisa pendente.

Conferir de verdade, sem gravar nada: `npm run ia:teste -- minuta` (gasta uma
minuta). A busca na web precisa estar permitida nas configurações da organização no
Console da Anthropic; se não estiver, a minuta falha e a tela mostra o motivo
que a Anthropic deu.

## O que ainda não está aqui

Etapas do escopo que dependem de material do escritório:

- **Salvar no Dropbox** — estrutura informada (PASTA DO ESCRITÓRIO / TIPO DO
  CLIENTE / EMPRESA / CLIENTE / CASO); falta o acesso.
