'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { entrarNoPainel } from './acoes'

const MENSAGENS: Record<string, string> = {
  credenciais_invalidas: 'E-mail ou senha incorretos.',
  usuario_inativo:
    'Este acesso não está ativo. Fale com o administrador do escritório.',
  acesso_bloqueado:
    'Acesso bloqueado por 15 minutos após 5 tentativas erradas. Tente novamente mais tarde.',
}

function BotaoEntrar() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="botao botao-largo" disabled={pending}>
      {pending ? 'Entrando…' : 'Entrar'}
    </button>
  )
}

export function FormularioDeEntrada() {
  const [estado, acao] = useActionState(entrarNoPainel, undefined)
  const codigo = estado?.codigoDeFalha
  const mensagem =
    codigo === undefined
      ? null
      : (MENSAGENS[codigo] ?? MENSAGENS['credenciais_invalidas'])

  return (
    <form action={acao} noValidate>
      {mensagem !== null && (
        <div className="aviso aviso-erro mb-4" role="alert" aria-live="polite">
          <span aria-hidden="true">▲</span>
          <div>{mensagem}</div>
        </div>
      )}

      <div className="mb-4">
        <label className="campo-rotulo" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="campo-entrada"
          placeholder="nome@eferreiraadvogados.com.br"
        />
      </div>

      <div className="mb-4">
        <label className="campo-rotulo" htmlFor="senha">
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          className="campo-entrada"
          placeholder="••••••••••••"
        />
      </div>

      <BotaoEntrar />
    </form>
  )
}
