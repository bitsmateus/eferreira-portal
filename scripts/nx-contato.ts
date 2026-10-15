/**
 * Diagnóstico da integração com a NX (só leitura): procura um contato pelo
 * número e mostra o que a NX respondeu. Não cria nem altera nada.
 *
 *   npm run nx:contato -- 35984022373
 *
 * Precisa de NX_API_URL e NX_API_TOKEN no ambiente (o token nunca é impresso).
 */
import { numeroParaNx } from '../src/lib/contato-nx'

async function principal(): Promise<void> {
  const base = process.env.NX_API_URL?.trim().replace(/\/+$/, '') ?? ''
  const token = process.env.NX_API_TOKEN?.trim() ?? ''
  if (base === '' || token === '') {
    console.log('NX_API_URL e/ou NX_API_TOKEN não configurados neste ambiente.')
    return
  }
  const numero = numeroParaNx(process.argv[2] ?? '')
  if (numero === null) {
    console.log('Informe um telefone com DDD. Ex.: npm run nx:contato -- 35984022373')
    return
  }
  const resposta = await fetch(`${base}/showcontact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ number: numero }),
    signal: AbortSignal.timeout(8000),
  })
  console.log('status:', resposta.status)
  console.log('corpo:', (await resposta.text()).slice(0, 500))
}

principal().catch((erro) => console.log('falhou:', erro instanceof Error ? erro.message : erro))
