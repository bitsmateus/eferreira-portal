/**
 * Usuários da equipe — dependência 3.7 (Anexo II), resolvida em 14/09/2026:
 * não há lista prévia de colaboradores, o escritório cria, edita e exclui
 * usuários dentro da própria ferramenta.
 *
 * "Excluir" aqui é desativar, não apagar a linha: `autorId` de andamento,
 * `criadoPorId` de cliente e a auditoria toda apontam para o usuário, e regra
 * 6 exige que esse rastro continue dizendo quem fez o quê mesmo depois que a
 * pessoa sai do escritório. Desativado, o usuário para de entrar (ver
 * `src/auth.ts`) — o efeito prático de "excluir" sem quebrar o histórico.
 *
 * Esta tela só alcança usuários da EQUIPE (operador e administrador). Fora do
 * alcance, de propósito:
 *  - o perfil CLIENTE, que é gerido pelo cartão "Acesso do cliente" na ficha
 *    do cliente (Anexo I, 1.d), não por aqui;
 *  - os usuários sem e-mail que existem só para uma credencial de API assinar
 *    andamentos (`src/lib/credenciais.ts`) — esses são geridos na tela da API.
 * O filtro abaixo (`perfil` na equipe E `email` preenchido) exclui os dois.
 *
 * Quem gere é o administrador (CLAUDE.md, perfis de acesso) — `exigirAdministrador`
 * decide isso no domínio, igual a `credenciais.ts`.
 */

import { AcaoAuditoria, PerfilUsuario, type Prisma, SituacaoUsuario } from '@prisma/client'
import { z } from 'zod'

import { exigirAdministrador, type SessaoServidor } from '@/lib/autorizacao'
import { ehViolacaoDeUnicidade, prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/auditoria'
import { gerarHashDeSenha, gerarSenhaAleatoria } from '@/lib/senha'
import { errosPorCampo, type ResultadoDeFormulario } from '@/lib/formulario'

// ---------------------------------------------------------------------------
// Escopo desta tela: só a equipe, só quem tem e-mail próprio.
// ---------------------------------------------------------------------------

const FILTRO_DA_EQUIPE: Prisma.UsuarioWhereInput = {
  perfil: { in: [PerfilUsuario.OPERADOR, PerfilUsuario.ADMINISTRADOR] },
  email: { not: null },
}

// ---------------------------------------------------------------------------
// Validação do cadastro
// ---------------------------------------------------------------------------

export const esquemaDeUsuario = z
  .object({
    nome: z
      .string()
      .trim()
      .min(3, 'Informe o nome completo.')
      .max(120, 'Nome longo demais.'),
    email: z.string().trim().toLowerCase().email('E-mail inválido.'),
    perfil: z.nativeEnum(PerfilUsuario),
  })
  .superRefine((dados, contexto) => {
    // O seletor da tela só oferece as duas opções, mas regra 2 vale também
    // para o que o próprio navegador manda: não confiamos, conferimos.
    if (dados.perfil === PerfilUsuario.CLIENTE) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['perfil'],
        message: 'Perfil inválido para esta tela. Use operador ou administrador.',
      })
    }
  })

export type DadosDeUsuario = z.output<typeof esquemaDeUsuario>
export type CamposDeUsuario = Record<keyof z.input<typeof esquemaDeUsuario>, string>

export function validarUsuario(
  campos: CamposDeUsuario,
): ResultadoDeFormulario<DadosDeUsuario> {
  const conferido = esquemaDeUsuario.safeParse(campos)
  return conferido.success
    ? { ok: true, dados: conferido.data }
    : { ok: false, erros: errosPorCampo(conferido.error) }
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export type LinhaDeUsuario = {
  id: string
  nome: string
  email: string
  perfil: PerfilUsuario
  situacao: SituacaoUsuario
  criadoEm: Date
  ultimoAcessoEm: Date | null
}

export async function listarUsuarios(sessao: SessaoServidor): Promise<LinhaDeUsuario[]> {
  exigirAdministrador(sessao)

  const usuarios = await prisma.usuario.findMany({
    where: FILTRO_DA_EQUIPE,
    select: {
      id: true,
      nome: true,
      email: true,
      perfil: true,
      situacao: true,
      criadoEm: true,
      ultimoAcessoEm: true,
    },
    orderBy: [{ situacao: 'asc' }, { nome: 'asc' }],
  })

  // O filtro já garante e-mail preenchido; o `?? ''` é só para o tipo.
  return usuarios.map((usuario) => ({ ...usuario, email: usuario.email ?? '' }))
}

/**
 * Verdadeiro quando este usuário é o único administrador ATIVO. É o que
 * impede o escritório de se trancar para fora do próprio painel — rebaixar,
 * desativar ou o último administrador se auto-excluir sem sobrar quem
 * desfaça.
 */
async function ehUltimoAdministradorAtivo(usuarioId: string): Promise<boolean> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { perfil: true, situacao: true },
  })
  if (usuario === null) return false
  if (usuario.perfil !== PerfilUsuario.ADMINISTRADOR) return false
  if (usuario.situacao !== SituacaoUsuario.ATIVO) return false

  const outrosAdministradoresAtivos = await prisma.usuario.count({
    where: {
      perfil: PerfilUsuario.ADMINISTRADOR,
      situacao: SituacaoUsuario.ATIVO,
      id: { not: usuarioId },
    },
  })

  return outrosAdministradoresAtivos === 0
}

// ---------------------------------------------------------------------------
// Criação — a senha sai do sistema, não da digitação do administrador
// (mesmo padrão de `prisma/seed.ts`), e aparece uma vez só na tela, como a
// chave de API em `credenciais.ts`.
// ---------------------------------------------------------------------------

export type ResultadoDeCriacaoDeUsuario =
  | { situacao: 'criado'; usuarioId: string; senha: string }
  | { situacao: 'email_em_uso' }

export async function criarUsuario(
  sessao: SessaoServidor,
  dados: DadosDeUsuario,
  emailDoAutor: string | null,
): Promise<ResultadoDeCriacaoDeUsuario> {
  exigirAdministrador(sessao)

  const existente = await prisma.usuario.findUnique({
    where: { email: dados.email },
    select: { id: true },
  })
  if (existente !== null) return { situacao: 'email_em_uso' }

  const senha = gerarSenhaAleatoria()

  try {
    const usuarioId = await prisma.$transaction(async (transacao) => {
      const criado = await transacao.usuario.create({
        data: {
          nome: dados.nome,
          email: dados.email,
          perfil: dados.perfil,
          senhaHash: await gerarHashDeSenha(senha),
          situacao: SituacaoUsuario.ATIVO,
        },
        select: { id: true },
      })

      await registrarAuditoria(
        {
          usuarioId: sessao.usuarioId,
          usuarioEmail: emailDoAutor,
          acao: AcaoAuditoria.CRIACAO,
          entidade: 'usuario',
          entidadeId: criado.id,
          // A senha, nunca — nem aqui, nem em lugar nenhum além do hash.
          detalhes: { nome: dados.nome, email: dados.email, perfil: dados.perfil },
        },
        transacao,
      )

      return criado.id
    })

    return { situacao: 'criado', usuarioId, senha }
  } catch (erro) {
    if (ehViolacaoDeUnicidade(erro)) return { situacao: 'email_em_uso' }
    throw erro
  }
}

// ---------------------------------------------------------------------------
// Edição — nome, e-mail e perfil. Senha e situação são ações próprias, cada
// uma com a sua confirmação.
// ---------------------------------------------------------------------------

export type ResultadoDeAtualizacaoDeUsuario =
  | { situacao: 'atualizado' }
  | { situacao: 'nao_encontrado' }
  | { situacao: 'email_em_uso' }
  | { situacao: 'ultimo_administrador' }

export async function atualizarUsuario(
  sessao: SessaoServidor,
  id: string,
  dados: DadosDeUsuario,
  emailDoAutor: string | null,
): Promise<ResultadoDeAtualizacaoDeUsuario> {
  exigirAdministrador(sessao)

  const alvo = await prisma.usuario.findFirst({
    where: { id, ...FILTRO_DA_EQUIPE },
    select: { id: true, perfil: true },
  })
  if (alvo === null) return { situacao: 'nao_encontrado' }

  if (alvo.perfil === PerfilUsuario.ADMINISTRADOR && dados.perfil !== PerfilUsuario.ADMINISTRADOR) {
    if (await ehUltimoAdministradorAtivo(id)) return { situacao: 'ultimo_administrador' }
  }

  try {
    await prisma.$transaction(async (transacao) => {
      await transacao.usuario.update({
        where: { id },
        data: { nome: dados.nome, email: dados.email, perfil: dados.perfil },
      })

      await registrarAuditoria(
        {
          usuarioId: sessao.usuarioId,
          usuarioEmail: emailDoAutor,
          acao: AcaoAuditoria.ATUALIZACAO,
          entidade: 'usuario',
          entidadeId: id,
          detalhes: { nome: dados.nome, email: dados.email, perfil: dados.perfil },
        },
        transacao,
      )
    })
  } catch (erro) {
    if (ehViolacaoDeUnicidade(erro)) return { situacao: 'email_em_uso' }
    throw erro
  }

  return { situacao: 'atualizado' }
}

// ---------------------------------------------------------------------------
// Situação — o "excluir" que não apaga. Ver o comentário do topo do arquivo.
// ---------------------------------------------------------------------------

export type ResultadoDeSituacao =
  | { situacao: 'alterado' }
  | { situacao: 'nao_encontrado' }
  | { situacao: 'ultimo_administrador' }

/** `CONVITE_PENDENTE` não se aplica aqui: ninguém cria usuário nesse estado
 *  (a senha já sai pronta, ver `criarUsuario`) — só ATIVO e INATIVO se alternam. */
type SituacaoAlteravel = Extract<SituacaoUsuario, 'ATIVO' | 'INATIVO'>

export async function alterarSituacaoDoUsuario(
  sessao: SessaoServidor,
  id: string,
  novaSituacao: SituacaoAlteravel,
  emailDoAutor: string | null,
): Promise<ResultadoDeSituacao> {
  exigirAdministrador(sessao)

  const alvo = await prisma.usuario.findFirst({
    where: { id, ...FILTRO_DA_EQUIPE },
    select: { id: true, situacao: true },
  })
  if (alvo === null) return { situacao: 'nao_encontrado' }
  if (alvo.situacao === novaSituacao) return { situacao: 'alterado' }

  if (novaSituacao === SituacaoUsuario.INATIVO && (await ehUltimoAdministradorAtivo(id))) {
    return { situacao: 'ultimo_administrador' }
  }

  await prisma.$transaction(async (transacao) => {
    await transacao.usuario.update({ where: { id }, data: { situacao: novaSituacao } })

    await registrarAuditoria(
      {
        usuarioId: sessao.usuarioId,
        usuarioEmail: emailDoAutor,
        acao: AcaoAuditoria.ATUALIZACAO,
        entidade: 'usuario',
        entidadeId: id,
        detalhes: { situacao: novaSituacao },
      },
      transacao,
    )
  })

  return { situacao: 'alterado' }
}

// ---------------------------------------------------------------------------
// Redefinição de senha — mesma lógica da criação: o sistema sorteia, a tela
// mostra uma vez.
// ---------------------------------------------------------------------------

export type ResultadoDeRedefinicao =
  | { situacao: 'redefinida'; senha: string }
  | { situacao: 'nao_encontrado' }

export async function redefinirSenha(
  sessao: SessaoServidor,
  id: string,
  emailDoAutor: string | null,
): Promise<ResultadoDeRedefinicao> {
  exigirAdministrador(sessao)

  const alvo = await prisma.usuario.findFirst({
    where: { id, ...FILTRO_DA_EQUIPE },
    select: { id: true },
  })
  if (alvo === null) return { situacao: 'nao_encontrado' }

  const senha = gerarSenhaAleatoria()

  await prisma.$transaction(async (transacao) => {
    await transacao.usuario.update({
      where: { id },
      data: {
        senhaHash: await gerarHashDeSenha(senha),
        // A redefinição também destrava: não faz sentido dar senha nova a
        // quem continuaria bloqueado pelas tentativas da senha antiga.
        tentativasFalhas: 0,
        bloqueadoAte: null,
      },
    })

    await registrarAuditoria(
      {
        usuarioId: sessao.usuarioId,
        usuarioEmail: emailDoAutor,
        acao: AcaoAuditoria.ATUALIZACAO,
        entidade: 'usuario',
        entidadeId: id,
        detalhes: { motivo: 'redefinicao_de_senha' },
      },
      transacao,
    )
  })

  return { situacao: 'redefinida', senha }
}
