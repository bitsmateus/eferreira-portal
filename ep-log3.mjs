import { chromium } from 'playwright'

const PAINEL = 'http://187.127.54.204:3000'
const navegador = await chromium.launch()
const contexto = await navegador.newContext({
  viewport: { width: 1440, height: 900 },
  storageState: 'C:/Users/mateu/AppData/Local/Temp/ep-sessao.json',
})
const aba = await contexto.newPage()

await aba.goto(`${PAINEL}/projects/eferreira-producao/app/portal/deployments`, {
  waitUntil: 'domcontentloaded',
})
await aba.waitForTimeout(4000)
const cabecalho = (await aba.locator('body').innerText()).split('\n').filter((l) => l.trim())
console.log('--- histórico ---')
console.log(cabecalho.slice(cabecalho.indexOf('Deployment History'), cabecalho.indexOf('Deployment History') + 10).join(' | '))

await aba.getByText('View', { exact: true }).first().click()
await aba.waitForTimeout(7000)
const t = (await aba.locator('body').innerText()).split('\n').filter((l) => l.trim())
console.log('--- fim do log ---')
console.log(t.slice(-18).join('\n'))
await navegador.close()
