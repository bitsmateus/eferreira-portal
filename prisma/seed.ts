/**
 * Semente mínima: um administrador e um operador. Nada mais.
 *
 * De propósito, esta semente NÃO cria cliente, caso nem status de andamento:
 *
 *  - a lista de status de andamento é dependência do escritório (Anexo II,
 *    item 3.5) e não se inventa;
 *  - os CPFs e CNPJs que aparecem no protótipo são fictícios e reprovam no
 *    dígito verificador, então não podem ser cadastrados pelo próprio sistema
 *    que exige validação real (regra 4).
 *
 * As senhas vêm de variável de ambiente (regra 8). Se não vierem, a semente
 * gera uma senha aleatória forte e imprime uma única vez no terminal.
 */

import 'dotenv/config'
import { AcaoAuditoria, PerfilUsuario, PrismaClient } from '@prisma/client'
import { gerarHashDeSenha, gerarSenhaAleatoria } from '../src/lib/senha'

const prisma = new PrismaClient()

type Semeado = { email: string; senha: string | null }

async function semearUsuario(
  nome: string,
  email: string,
  perfil: PerfilUsuario,
  senhaDoAmbiente: string | undefined,
): Promise<Semeado> {
  const existente = await prisma.usuario.findUnique({ where: { email } })
  if (existente !== null) {
    console.log(`· ${email} já existe — mantido como está.`)
    return { email, senha: null }
  }

  const senha =
    senhaDoAmbiente !== undefined && senhaDoAmbiente.trim() !== ''
      ? senhaDoAmbiente
      : gerarSenhaAleatoria()

  const usuario = await prisma.usuario.create({
    data: {
      nome,
      email,
      perfil,
      senhaHash: await gerarHashDeSenha(senha),
    },
  })

  await prisma.auditoria.create({
    data: {
      usuarioId: usuario.id,
      usuarioEmail: usuario.email,
      acao: AcaoAuditoria.CRIACAO,
      entidade: 'usuario',
      entidadeId: usuario.id,
      detalhes: { origem: 'semente', perfil },
    },
  })

  return { email, senha }
}

async function principal() {
  console.log('Semeando o Portal do Cliente — E. Ferreira Advogados\n')

  const administrador = await semearUsuario(
    process.env['SEMENTE_ADMIN_NOME'] ?? 'Administrador E. Ferreira',
    process.env['SEMENTE_ADMIN_EMAIL'] ?? 'admin@eferreiraadvogados.com.br',
    PerfilUsuario.ADMINISTRADOR,
    process.env['SEMENTE_ADMIN_SENHA'],
  )

  const operador = await semearUsuario(
    process.env['SEMENTE_OPERADOR_NOME'] ?? 'Operador E. Ferreira',
    process.env['SEMENTE_OPERADOR_EMAIL'] ?? 'operador@eferreiraadvogados.com.br',
    PerfilUsuario.OPERADOR,
    process.env['SEMENTE_OPERADOR_SENHA'],
  )

  console.log('\n--- credenciais ---')
  for (const { email, senha } of [administrador, operador]) {
    if (senha === null) {
      console.log(`${email}  (senha inalterada)`)
    } else {
      console.log(`${email}  ${senha}`)
    }
  }
  console.log(
    '\nTroque estas senhas no primeiro acesso. Elas não são gravadas em lugar nenhum além do hash.',
  )
  console.log(
    'A lista de status de andamento continua vazia — depende do escritório (Anexo II, 3.5).',
  )
}

principal()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (erro: unknown) => {
    console.error(erro)
    await prisma.$disconnect()
    process.exit(1)
  })
