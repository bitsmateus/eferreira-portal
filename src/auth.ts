/**
 * Auth.js v5 — acesso interno por e-mail e senha individuais (Anexo I, 1.b),
 * com Argon2id e bloqueio após 5 tentativas por 15 minutos.
 *
 * Roda em Node (usa Prisma e Argon2). O middleware usa `src/auth.config.ts`.
 */

import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { CredentialsSignin } from 'next-auth'
import { AcaoAuditoria, PerfilUsuario, SituacaoUsuario } from '@prisma/client'
import { z } from 'zod'

import { configuracaoAuth } from '@/auth.config'
import { prisma } from '@/lib/prisma'
import { gastarTempoDeVerificacao, senhaConfere } from '@/lib/senha'
import {
  estaBloqueado,
  minutosRestantesDeBloqueio,
  registrarFalha,
  registrarSucesso,
} from '@/lib/bloqueio'
import { registrarAuditoria } from '@/lib/auditoria'

/**
 * Erro com mensagem própria. Só o bloqueio ganha texto específico — para o
 * resto, a mensagem é sempre a mesma, para não revelar quais e-mails existem.
 */
class FalhaDeAcesso extends CredentialsSignin {
  constructor(codigo: string) {
    super(codigo)
    this.code = codigo
  }
}

const entradaDeAcesso = z.object({
  email: z.string().trim().toLowerCase().email(),
  senha: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...configuracaoAuth,
  trustHost: true,
  providers: [
    Credentials({
      name: 'credenciais',
      credentials: {
        email: { label: 'E-mail', type: 'email' },
        senha: { label: 'Senha', type: 'password' },
      },

      async authorize(credenciais) {
        const analise = entradaDeAcesso.safeParse(credenciais)
        if (!analise.success) {
          await gastarTempoDeVerificacao('entrada-invalida')
          throw new FalhaDeAcesso('credenciais_invalidas')
        }

        const { email, senha } = analise.data

        const usuario = await prisma.usuario.findUnique({
          where: { email },
          include: { cliente: { select: { contratoAssinadoEm: true } } },
        })

        // E-mail inexistente: gasta o mesmo tempo e devolve a mesma mensagem.
        if (usuario === null || usuario.senhaHash === null) {
          await gastarTempoDeVerificacao(senha)
          throw new FalhaDeAcesso('credenciais_invalidas')
        }

        if (usuario.situacao !== SituacaoUsuario.ATIVO) {
          await gastarTempoDeVerificacao(senha)
          throw new FalhaDeAcesso('usuario_inativo')
        }

        const agora = new Date()

        if (estaBloqueado(usuario, agora)) {
          const minutos = minutosRestantesDeBloqueio(usuario, agora)
          await registrarAuditoria({
            usuarioId: usuario.id,
            usuarioEmail: usuario.email,
            acao: AcaoAuditoria.AUTENTICACAO,
            entidade: 'usuario',
            entidadeId: usuario.id,
            detalhes: { resultado: 'bloqueado', minutosRestantes: minutos },
          })
          throw new FalhaDeAcesso('acesso_bloqueado')
        }

        const confere = await senhaConfere(senha, usuario.senhaHash)

        if (!confere) {
          const novoEstado = registrarFalha(usuario, agora)
          await prisma.usuario.update({
            where: { id: usuario.id },
            data: {
              tentativasFalhas: novoEstado.tentativasFalhas,
              bloqueadoAte: novoEstado.bloqueadoAte,
            },
          })
          await registrarAuditoria({
            usuarioId: usuario.id,
            usuarioEmail: usuario.email,
            acao: AcaoAuditoria.AUTENTICACAO,
            entidade: 'usuario',
            entidadeId: usuario.id,
            detalhes: {
              resultado: 'senha_incorreta',
              tentativasFalhas: novoEstado.tentativasFalhas,
              bloqueou: novoEstado.bloqueadoAte !== null,
            },
          })
          throw new FalhaDeAcesso(
            novoEstado.bloqueadoAte !== null
              ? 'acesso_bloqueado'
              : 'credenciais_invalidas',
          )
        }

        const limpo = registrarSucesso()
        await prisma.usuario.update({
          where: { id: usuario.id },
          data: {
            tentativasFalhas: limpo.tentativasFalhas,
            bloqueadoAte: limpo.bloqueadoAte,
            ultimoAcessoEm: agora,
          },
        })

        await registrarAuditoria({
          usuarioId: usuario.id,
          usuarioEmail: usuario.email,
          acao: AcaoAuditoria.AUTENTICACAO,
          entidade: 'usuario',
          entidadeId: usuario.id,
          detalhes: { resultado: 'sucesso', perfil: usuario.perfil },
        })

        return {
          id: usuario.id,
          name: usuario.nome,
          email: usuario.email,
          perfil: usuario.perfil,
          clienteId: usuario.clienteId,
          contratoAssinado:
            usuario.perfil === PerfilUsuario.CLIENTE
              ? usuario.cliente?.contratoAssinadoEm != null
              : false,
        }
      },
    }),
  ],
})

/** Mensagens que a tela de login mostra para cada código de falha. */
export const MENSAGENS_DE_FALHA: Record<string, string> = {
  credenciais_invalidas: 'E-mail ou senha incorretos.',
  usuario_inativo:
    'Este acesso não está ativo. Fale com o administrador do escritório.',
  acesso_bloqueado:
    'Acesso bloqueado por 15 minutos após 5 tentativas erradas. Tente novamente mais tarde.',
}
