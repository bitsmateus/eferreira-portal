import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

const PAINEL = 'http://187.127.54.204:3000'
const SEGREDOS = 'C:/Users/mateu/AppData/Local/Temp/eferreira-infra.json'
const s = JSON.parse(readFileSync(SEGREDOS, 'utf8'))

const navegador = await chromium.launch()
const contexto = await navegador.newContext({
  viewport: { width: 1440, height: 900 },
  storageState: 'C:/Users/mateu/AppData/Local/Temp/ep-sessao.json',
})
const aba = await contexto.newPage()

for (const projeto of ['eferreira-producao', 'eferreira-homologacao']) {
  const admin = s[`${projeto}.admin.senha`] ?? randomBytes(12).toString('base64url')
  const operador = s[`${projeto}.operador.senha`] ?? randomBytes(12).toString('base64url')
  s[`${projeto}.admin.senha`] = admin
  s[`${projeto}.operador.senha`] = operador
  writeFileSync(SEGREDOS, JSON.stringify(s, null, 2))

  await aba.goto(`${PAINEL}/projects/${projeto}/app/portal/environment`, {
    waitUntil: 'domcontentloaded',
  })
  await aba.waitForTimeout(5000)

  const editor = aba.locator('.cm-content').first()
  const atual = await editor.innerText()
  if (atual.includes('SEMENTE_ADMIN_SENHA')) {
    console.log(projeto, '- semente já configurada')
    continue
  }

  await editor.click()
  await aba.keyboard.press('Control+Home')
  await aba.keyboard.type(
    [
      'SEMENTE_ADMIN_EMAIL=admin@eferreira.adv.br',
      'SEMENTE_ADMIN_NOME=Administrador E. Ferreira',
      `SEMENTE_ADMIN_SENHA=${admin}`,
      'SEMENTE_OPERADOR_EMAIL=operador@eferreira.adv.br',
      'SEMENTE_OPERADOR_NOME=Operador E. Ferreira',
      `SEMENTE_OPERADOR_SENHA=${operador}`,
      '',
    ].join('\n'),
    { delay: 0 },
  )
  await aba.waitForTimeout(1200)
  await aba.getByRole('button', { name: 'Save', exact: true }).first().click()
  await aba.waitForTimeout(4000)
  console.log(projeto, '- semente configurada')
}

await navegador.close()
