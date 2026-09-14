import { chromium } from 'playwright'

const PAINEL = 'http://187.127.54.204:3000'
const navegador = await chromium.launch()
const contexto = await navegador.newContext({
  viewport: { width: 1440, height: 900 },
  storageState: 'C:/Users/mateu/AppData/Local/Temp/ep-sessao.json',
})
const aba = await contexto.newPage()

await aba.goto(`${PAINEL}/projects/eferreira-producao/app/portal`, { waitUntil: 'domcontentloaded' })
await aba.waitForTimeout(9000)
await aba.screenshot({ path: 'C:/Users/mateu/AppData/Local/Temp/ep-24-portal.png', fullPage: true })
const t = (await aba.locator('body').innerText()).split('\n').filter((l) => l.trim())
console.log(t.slice(t.indexOf('Logs')).join('\n').slice(0, 2500))
await navegador.close()
