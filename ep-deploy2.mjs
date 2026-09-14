import { chromium } from 'playwright'

const PAINEL = 'http://187.127.54.204:3000'
const navegador = await chromium.launch()
const contexto = await navegador.newContext({
  viewport: { width: 1440, height: 900 },
  storageState: 'C:/Users/mateu/AppData/Local/Temp/ep-sessao.json',
})
const aba = await contexto.newPage()

await aba.goto(`${PAINEL}/projects/eferreira-producao/app/portal`, { waitUntil: 'domcontentloaded' })
await aba.waitForTimeout(3500)
await aba.getByRole('button', { name: 'Deploy', exact: true }).first().click()
await aba.waitForTimeout(6000)
console.log('deploy disparado em produção')
await navegador.close()
