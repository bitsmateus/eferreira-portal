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
import { conferirCodigo } from '@/lib/acesso-do-cliente'
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

/**
 * O endereço de origem chega pelo formulário porque `authorize` não recebe a
 * requisição. Ele NÃO é usado para decidir nada — só para a auditoria e para o
 * limite de pedidos. Quem o monta é a ação de servidor, a partir dos
 * cabeçalhos, nunca o navegador (regra 2).
 */
const entradaDoCliente = z.object({
  documento: z.string().trim().min(1),
  codigo: z.string().trim().min(1),
  enderecoIp: z
    .string()
    .trim()
    .transform((valor) => (valor === '' ? null : valor))
    .nullable(),
  agenteUsuario: z
    .string()
    .trim()
    .transform((valor) => (valor === '' ? null : valor))
    .nullable(),
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

    /**
     * Entrada do cliente: CPF ou CNPJ mais o código que chegou por e-mail
     * (Anexo II, item 3.6). A conferência inteira — elegibilidade, validade,
     * tentativas, auditoria — vive em `src/lib/acesso-do-cliente.ts`; aqui só
     * se transforma o resultado dela em sessão.
     *
     * Sem senha, de propósito: o cliente não tem senha para esquecer, para
     * repetir de outro serviço ou para o escritório precisar guardar.
     */
    Credentials({
      id: 'codigo-do-cliente',
      name: 'código do cliente',
      credentials: {
        documento: { label: 'CPF ou CNPJ', type: 'text' },
        codigo: { label: 'Código', type: 'text' },
        enderecoIp: { label: 'Endereço de origem', type: 'text' },
        agenteUsuario: { label: 'Agente', type: 'text' },
      },

      async authorize(credenciais) {
        const analise = entradaDoCliente.safeParse(credenciais)
        if (!analise.success) {
          await gastarTempoDeVerificacao('entrada-invalida')
          throw new FalhaDeAcesso('codigo_invalido')
        }

        const { documento, codigo, enderecoIp, agenteUsuario } = analise.data

        const resultado = await conferirCodigo(documento, codigo, {
          enderecoIp,
          agenteUsuario,
        })

        // Um motivo só: documento que não existe, contrato não assinado,
        // código errado ou vencido dão exatamente a mesma resposta.
        if (resultado.situacao !== 'confere') {
          throw new FalhaDeAcesso('codigo_invalido')
        }

        return {
          id: resultado.usuarioId,
          name: resultado.nome,
          // O cliente não tem e-mail no `Usuario` — ele vive no cadastro.
          email: null,
          perfil: PerfilUsuario.CLIENTE,
          clienteId: resultado.clienteId,
          contratoAssinado: true,
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
  codigo_invalido: 'Código incorreto ou vencido. Peça um novo código.',
}
