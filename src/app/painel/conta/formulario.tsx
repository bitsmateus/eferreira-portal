'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { salvarMinhaConta } from './acoes'

function Botao() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="botao">
      {pending ? 'Salvando…' : 'Salvar'}
    </button>
  )
}

export function FormularioDaMinhaConta({ nome, email }: { nome: string; email: string }) {
  const [estado, salvar] = useActionState(salvarMinhaConta, undefined)
  const [campos, setCampos] = useState({ nome, email })

  return (
    <form action={salvar} className="cartao max-w-[520px]">
      <div className="cartao-cabecalho">
        <h2>Meus dados</h2>
      </div>
      <div className="cartao-corpo">
        {estado?.mensagem !== undefined && (
          <div className="aviso aviso-erro mb-3" role="alert">
            <span aria-hidden="true">▲</span>
            <div>{estado.mensagem}</div>
          </div>
        )}
        {estado?.sucesso !== undefined && (
          <div className="aviso aviso-info mb-3" role="status">
            <span aria-hidden="true">▲</span>
            <div>{estado.sucesso}</div>
          </div>
        )}

        <div className="mb-[15px]">
          <label className="campo-rotulo" htmlFor="nome">
            Nome
          </label>
          <input
            id="nome"
            name="nome"
            required
            maxLength={120}
            className="campo-entrada"
            value={campos.nome}
            onChange={(e) => setCampos((c) => ({ ...c, nome: e.target.value }))}
          />
          {estado?.erros?.['nome'] !== undefined && (
            <p className="dica dica-erro">{estado.erros['nome']}</p>
          )}
        </div>

        <div className="mb-[15px]">
          <label className="campo-rotulo" htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            maxLength={180}
            className="campo-entrada"
            value={campos.email}
            onChange={(e) => setCampos((c) => ({ ...c, email: e.target.value }))}
          />
          {estado?.erros?.['email'] !== undefined && (
            <p className="dica dica-erro">{estado.erros['email']}</p>
          )}
        </div>

        <div className="my-4 border-t border-borda" />

        <div className="mb-[15px]">
          <label className="campo-rotulo" htmlFor="senhaNova">
            Nova senha (opcional)
          </label>
          <input
            id="senhaNova"
            name="senhaNova"
            type="password"
            autoComplete="new-password"
            maxLength={128}
            className="campo-entrada"
          />
          {estado?.erros?.['senhaNova'] !== undefined ? (
            <p className="dica dica-erro">{estado.erros['senhaNova']}</p>
          ) : (
            <p className="dica">Mínimo de 8 caracteres. Em branco, a senha não muda.</p>
          )}
        </div>

        <div className="mb-[15px]">
          <label className="campo-rotulo" htmlFor="senhaAtual">
            Senha atual
          </label>
          <input
            id="senhaAtual"
            name="senhaAtual"
            type="password"
            autoComplete="current-password"
            maxLength={128}
            className="campo-entrada"
          />
          {estado?.erros?.['senhaAtual'] !== undefined ? (
            <p className="dica dica-erro">{estado.erros['senhaAtual']}</p>
          ) : (
            <p className="dica">Só é exigida para trocar o e-mail ou a senha.</p>
          )}
        </div>

        <Botao />
      </div>
    </form>
  )
}
