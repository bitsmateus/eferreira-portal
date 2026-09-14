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
await aba.getByText('View', { exact: true }).first().click()
await aba.waitForTimeout(7000)
const t = await aba.locator('body').innerText()
const linhas = t.split('\n').filter((l) => l.trim())
console.log(linhas.slice(-45).join('\n'))
await navegador.close()
