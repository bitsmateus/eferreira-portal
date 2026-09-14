import { chromium } from 'playwright'

const PAINEL = 'http://187.127.54.204:3000'
const navegador = await chromium.launch()
const contexto = await navegador.newContext({
  viewport: { width: 1440, height: 900 },
  storageState: 'C:/Users/mateu/AppData/Local/Temp/ep-sessao.json',
})
const aba = await contexto.newPage()

for (const projeto of ['eferreira-producao', 'eferreira-homologacao']) {
  await aba.goto(`${PAINEL}/projects/${projeto}/app/portal/environment`, {
    waitUntil: 'domcontentloaded',
  })
  await aba.waitForTimeout(5000)

  const editor = aba.locator('.cm-content').first()
  const atual = await editor.innerText()

  if (atual.includes('PORT=3000')) {
    console.log(projeto, '- PORT já definida')
  } else {
    await editor.click()
    await aba.keyboard.press('Control+Home')
    await aba.keyboard.type('PORT=3000\n', { delay: 0 })
    await aba.waitForTimeout(1200)
    await aba.getByRole('button', { name: 'Save', exact: true }).first().click()
    await aba.waitForTimeout(4000)
    console.log(projeto, '- PORT=3000 acrescentada')
  }

  await aba.goto(`${PAINEL}/projects/${projeto}/app/portal`, { waitUntil: 'domcontentloaded' })
  await aba.waitForTimeout(3000)
  await aba.getByRole('button', { name: 'Deploy', exact: true }).first().click()
  await aba.waitForTimeout(6000)
  console.log(projeto, '- deploy disparado')
}

await navegador.close()
