'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { errosPorCampo, texto, type ErrosDeCampo } from '@/lib/formulario'
import { emailDaSessao, exigirSessaoDaEquipe } from '@/lib/sessao'
import { atualizarMinhaConta, TAMANHO_MINIMO_DA_SENHA } from '@/lib/usuarios'

export type EstadoDaMinhaConta =
  | { erros?: ErrosDeCampo; mensagem?: string; sucesso?: string }
  | undefined

const esquema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo.').max(120, 'Nome longo demais.'),
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  senhaAtual: z.string().max(128),
  senhaNova: z
    .string()
    .max(128, 'Senha longa demais.')
    .refine(
      (valor) => valor === '' || valor.length >= TAMANHO_MINIMO_DA_SENHA,
      `A senha precisa de pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.`,
    ),
})

/**
 * Edita a conta de QUEM ESTÁ LOGADO. Não recebe id nenhum: a sessão do
 * servidor é a única fonte de "quem sou eu" (regra 2).
 */
export async function salvarMinhaConta(
  _estado: EstadoDaMinhaConta,
  dados: FormData,
): Promise<EstadoDaMinhaConta> {
  const sessao = await exigirSessaoDaEquipe()

  const conferido = esquema.safeParse({
    nome: texto(dados, 'nome'),
    email: texto(dados, 'email'),
    // Senhas não passam por `texto` (que apara espaços): espaço pode fazer parte.
    senhaAtual: String(dados.get('senhaAtual') ?? ''),
    senhaNova: String(dados.get('senhaNova') ?? ''),
  })
  if (!conferido.success) return { erros: errosPorCampo(conferido.error) }

  const resultado = await atualizarMinhaConta(sessao, conferido.data, await emailDaSessao(sessao))

  if (resultado.situacao === 'nao_encontrado') return { mensagem: 'Conta não encontrada.' }
  if (resultado.situacao === 'email_em_uso') {
    return { erros: { email: 'Este e-mail já tem cadastro na equipe.' } }
  }
  if (resultado.situacao === 'senha_atual_errada') {
    return {
      erros: { senhaAtual: 'Senha atual incorreta. Ela é exigida para trocar e-mail ou senha.' },
    }
  }

  revalidatePath('/painel/conta')
  return { sucesso: 'Dados salvos.' }
}
