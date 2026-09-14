import { chromium } from 'playwright'

const PAINEL = 'http://187.127.54.204:3000'
const navegador = await chromium.launch()
const contexto = await navegador.newContext({
  viewport: { width: 1440, height: 900 },
  storageState: 'C:/Users/mateu/AppData/Local/Temp/ep-sessao.json',
})
const aba = await contexto.newPage()

const alvos = [
  ['eferreira-producao', 'portal.eferreira.adv.br'],
  ['eferreira-homologacao', 'homologacao.eferreira.adv.br'],
]

for (const [projeto, host] of alvos) {
  await aba.goto(`${PAINEL}/projects/${projeto}/app/portal/domains`, {
    waitUntil: 'domcontentloaded',
  })
  await aba.waitForTimeout(4000)
  if ((await aba.locator('body').innerText()).includes(host)) {
    console.log(projeto, '- já cadastrado')
    continue
  }

  await aba.getByText('Add Domain', { exact: true }).first().click()
  await aba.waitForTimeout(2500)

  // O campo Host é o único input de texto sem atributo name no diálogo.
  const entradas = aba.locator('[role="dialog"] input, .chakra-modal__content input')
  const total = await entradas.count()
  let preenchido = false
  for (let i = 0; i < total; i += 1) {
    const campo = entradas.nth(i)
    const tipo = await campo.getAttribute('type')
    const nome = await campo.getAttribute('name')
    if (tipo === 'checkbox') continue
    if (nome === null || nome === 'host') {
      await campo.fill(host)
      preenchido = true
      break
    }
  }
  console.log(projeto, '- host preenchido:', preenchido)

  await aba.locator('input[name="serviceDestination.port"]').fill('3000')
  await aba.waitForTimeout(800)
  await aba.getByRole('button', { name: 'Create', exact: true }).click()
  await aba.waitForTimeout(4500)
}

for (const [projeto] of alvos) {
  await aba.goto(`${PAINEL}/projects/${projeto}/app/portal/domains`, { waitUntil: 'domcontentloaded' })
  await aba.waitForTimeout(3000)
  const linhas = (await aba.locator('body').innerText()).split('\n').filter((l) => l.startsWith('http'))
  console.log(projeto, '->', linhas.join(' | '))
}

await navegador.close()
