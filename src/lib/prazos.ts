/**
 * Prazo sugerido de uma publicação do DJEN (09/11/2026, esteira de
 * acompanhamento — ver `docs/publicacoes.md`).
 *
 * É SUGESTÃO, nunca prazo oficial: a equipe confirma na fila de conferência
 * antes de virar evento. Por isso o cálculo é simples e declarado:
 *
 *  - a publicação é o primeiro dia útil depois da disponibilização no diário,
 *    e o prazo começa no primeiro dia útil depois da publicação (Lei
 *    11.419/2006, art. 4º, §§ 3º e 4º);
 *  - dia útil = segunda a sexta, fora dos feriados nacionais, dos feriados
 *    móveis do calendário forense (Carnaval, Sexta-feira Santa, Corpus
 *    Christi) e do recesso de 20/12 a 20/01 (CPC, art. 220);
 *  - feriado municipal, estadual e suspensão de expediente decretada pelo
 *    tribunal NÃO entram — por isso a tela sempre diz "sugerido".
 *
 * Tudo trabalha com o dia civil "AAAA-MM-DD" (regra 11), sem hora.
 */

export type Contagem = 'uteis' | 'corridos'

const UM_DIA_MS = 24 * 60 * 60 * 1000

function paraData(dia: string): Date {
  const [ano = '0', mes = '1', d = '1'] = dia.split('-')
  return new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(d)))
}

function paraDia(data: Date): string {
  return data.toISOString().slice(0, 10)
}

export function somarDias(dia: string, quantidade: number): string {
  return paraDia(new Date(paraData(dia).getTime() + quantidade * UM_DIA_MS))
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), como "AAAA-MM-DD". */
export function pascoa(ano: number): string {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return paraDia(new Date(Date.UTC(ano, mes - 1, dia)))
}

/** Feriados nacionais fixos (Lei 662/1949, Lei 14.759/2023). */
const FIXOS = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25']

const cacheDeFeriados = new Map<number, Set<string>>()

export function feriadosDoAno(ano: number): Set<string> {
  const guardado = cacheDeFeriados.get(ano)
  if (guardado !== undefined) return guardado

  const p = pascoa(ano)
  const feriados = new Set<string>([
    ...FIXOS.map((mmdd) => `${ano}-${mmdd}`),
    somarDias(p, -48), // segunda de Carnaval
    somarDias(p, -47), // terça de Carnaval
    somarDias(p, -2), // Sexta-feira Santa
    somarDias(p, 60), // Corpus Christi
  ])
  cacheDeFeriados.set(ano, feriados)
  return feriados
}

/** Recesso forense: 20/12 a 20/01, inclusive (CPC, art. 220). */
export function emRecesso(dia: string): boolean {
  const mmdd = dia.slice(5)
  return mmdd >= '12-20' || mmdd <= '01-20'
}

export function ehDiaUtil(dia: string): boolean {
  const semana = paraData(dia).getUTCDay()
  if (semana === 0 || semana === 6) return false
  if (emRecesso(dia)) return false
  return !feriadosDoAno(Number(dia.slice(0, 4))).has(dia)
}

/** O primeiro dia útil ESTRITAMENTE depois de `dia`. */
export function proximoDiaUtil(dia: string): string {
  let atual = somarDias(dia, 1)
  while (!ehDiaUtil(atual)) atual = somarDias(atual, 1)
  return atual
}

/** O próprio dia, se útil; senão o próximo útil. */
function oUProximoUtil(dia: string): string {
  return ehDiaUtil(dia) ? dia : proximoDiaUtil(dia)
}

/** Dia em que se considera publicada a comunicação disponibilizada em `dia`. */
export function diaDaPublicacao(disponibilizacao: string): string {
  return proximoDiaUtil(disponibilizacao)
}

/**
 * O último dia do prazo de `quantidade` dias, contado a partir da
 * disponibilização no diário. `null` para quantidade inválida.
 */
export function vencimentoDoPrazo(
  disponibilizacao: string,
  quantidade: number,
  contagem: Contagem,
): string | null {
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 365) return null

  const publicacao = diaDaPublicacao(disponibilizacao)

  if (contagem === 'corridos') {
    return oUProximoUtil(somarDias(publicacao, quantidade))
  }

  let atual = publicacao
  for (let contados = 0; contados < quantidade; contados += 1) {
    atual = proximoDiaUtil(atual)
  }
  return atual
}
