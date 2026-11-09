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

## O que ainda não está aqui

Etapas do escopo que dependem de material do escritório:

- **Minuta da petição intermediária e da inicial** — precisa dos modelos de
  peça do escritório (regra 10: não se inventa texto jurídico).
- **Salvar no Dropbox** — precisa do acesso e da estrutura de pastas atual.
- **Chave da IA** — conta de desenvolvedor do escritório com cartão.
