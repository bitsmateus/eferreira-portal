import { chromium } from 'playwright'

const PAINEL = 'http://187.127.54.204:3000'
const navegador = await chromium.launch()
const contexto = await navegador.newContext({
  viewport: { width: 1440, height: 900 },
  storageState: 'C:/Users/mateu/AppData/Local/Temp/ep-sessao.json',
})
const aba = await contexto.newPage()

// Confere se as variáveis entraram e se o build ficou em Dockerfile.
await aba.goto(`${PAINEL}/projects/eferreira-producao/app/portal/environment`, {
  waitUntil: 'domcontentloaded',
})
await aba.waitForTimeout(4000)
const areas = aba.locator('textarea')
const conteudo = (await areas.count()) > 0
  ? await areas.first().inputValue()
  : await aba.locator('.cm-content').first().innerText()

for (const linha of conteudo.split('\n').filter((l) => l.trim())) {
  const [chave] = linha.split('=')
  const sensivel = /SENHA|SECRET|CHAVE_SECRETA|TOKEN|CRYPT|DATABASE_URL/.test(chave)
  console.log(' ', sensivel ? `${chave}=(definida)` : linha)
}

await aba.goto(`${PAINEL}/projects/eferreira-producao/app/portal/build`, { waitUntil: 'domcontentloaded' })
await aba.waitForTimeout(3000)
await aba.screenshot({ path: 'C:/Users/mateu/AppData/Local/Temp/ep-21-build.png', fullPage: true })

await navegador.close()
