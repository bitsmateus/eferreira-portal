import { chromium } from 'playwright'

const PAINEL = 'http://187.127.54.204:3000'
const navegador = await chromium.launch()
const contexto = await navegador.newContext({
  viewport: { width: 1440, height: 900 },
  storageState: 'C:/Users/mateu/AppData/Local/Temp/ep-sessao.json',
})
const aba = await contexto.newPage()

await aba.goto(`${PAINEL}/projects/eferreira-producao/app/portal`, { waitUntil: 'domcontentloaded' })
await aba.waitForTimeout(5000)
await aba.getByLabel('Console').first().click()
await aba.waitForTimeout(5000)

await aba.getByRole('button', { name: 'Bash', exact: true }).click()
await aba.waitForTimeout(6000)
await aba.screenshot({ path: 'C:/Users/mateu/AppData/Local/Temp/ep-30-bash.png' })

await aba.locator('.xterm-screen, .xterm').first().click()
await aba.waitForTimeout(1500)
await aba.keyboard.type('npm run prisma:semear', { delay: 25 })
await aba.keyboard.press('Enter')
await aba.waitForTimeout(40000)
await aba.screenshot({ path: 'C:/Users/mateu/AppData/Local/Temp/ep-31-semeado.png', fullPage: true })

const tela = await aba.locator('.xterm-rows').first().innerText().catch(() => '(sem leitura)')
console.log(tela.split('\n').filter((l) => l.trim()).slice(-20).join('\n'))

await navegador.close()
